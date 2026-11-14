# SA2 设计攻击评审 — issue #471：Cordis rc.12 Hub/Peer/SessionHost 全链兼容（验收能力扩展）

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-471_design.md`（SA1 设计，475 行，基线 HEAD `d59a4d1`） | 已逐节实读 |
| `wiki/raw/task_issue-471.md`（Issue 简报，9 条 AC，`## Comments` 空） | 已读 |
| `wiki/raw/task_issue-471_sa6_acceptance_contract.md`（641 行，approve） | 已逐节实读 |
| `wiki/raw/task_issue-471_dispatch.md` | 已读（Round 1，base `d59a4d1`） |
| #470 证据：`task_issue-470_{design,conflict_report,impl_conflict_report,sa3_impl,sa9_standards,sa10_spec}.md` | 已按锚点抽查（R1–R9、4 test-d 红、28 环境红、§8.6/§8.8 B1-only 口径、S9 findings） |
| ADR 0035 / ADR 0032 / `docs/protocols/instance-replication-v1.md` / `docs/integration/cordis-plugin-hosting.md` | 已读关键节（§2/§3/§4/§5） |
| 源码实读：`packages/ws-replication/src/plugin.ts`（seam :200–298、apply :508–514/:703–708、effect :581–587/:673–678/:781–786、waitForLive :761）、`hub-edge.ts:356–364`、`hub-connection.ts:175–182`、`hub-namespace.ts:1046–1054`、`packages/dsh-persistence/src/profile.ts:41–109`、`packages/persistence/test/fixtures/cordis-baselines/{baselines.json,run-baseline.mjs(870 行全读),gates.mjs(423 行全读)}`、`packages/persistence/test/{cordis-root-real-timer,cordis-baseline-provenance,cordis-public-surface}.test.ts`、4 具名 fixture、`apps/yjs-server/test/{third-party-composition-red,issue270-regression-anchors,persistence-drain-shutdown}.test.ts`、`registry-sa7-rev1.test.ts`、各 `package.json`、根 `vitest.config.ts`、`.cache/cordis-baselines/overlay/{B1,B3}/…/reflect.d.ts` | 本会话独立核验 |

`git rev-parse HEAD` = `d59a4d1…`，与设计基线一致。`wiki/raw/task_issue-471_{relevant_decisions,conflict_report,sa2_review}.md` 确认不存在（iteration 0），本文件为首轮评审。

## 2. Verdict

> **【Round 2（iteration 1 增量复审）后的当前裁决：reject（1 项 MAJOR：F-8）——见 §17。**上轮 F-1/F-3/F-4/F-6/F-7 已按判据闭合并从阻断清单移除；F-5 主体闭合、余一句级残留（MINOR）。以下 Round 1 记录保留作修订映射的历史底稿。】

**reject**（3 项 MAJOR；无 BLOCKER）。总体判断：设计的主体架构（零生产改动判定、6 suite 扩展、单点 runner 复用、S1–S5 追认框架、TDD 步序）与仓库事实高度吻合，绝大多数断言锚点逐条对上源码；但**验收设施的三个机械环节按设计原文无法产出其承诺的证据**（负控 env 不达新 suite、G10 分类算法自相矛盾且漏判、AC6 interop 载体含违反契约的兜底选项），实现前必须修订。全部修订都是局部的、不动摇设计骨架。

---

## 3. 九项专项核验结论（dispatch 项 1–9）

| # | 核验项 | 结论 | 关键证据（文件:行） |
|---|---|---|---|
| 1 | 生产岸零改动判定 | **pass** | `plugin.ts:244–253`（symbol 优先/legacy 兜底/malformed 不回落）、`:247`（null 宿主 loud fail）、`:269–271`（`timer.ctx===undefined` 级联 / `===null` 畸形）、`:508–514`、`:703–708`（apply 内同步 throw，先于任何 await）、`:261–263`（timer 服务文案逐字一致）、`:584/:675/:783`（三处 provide + `:581–587/:673–678/:781–786` 反向 yield 序）。反向闸门可用（见 F-4 过程风险） |
| 2 | 3×3×7 矩阵可执行性 | **pass（附 F-5 计账口径歧义）** | TimerService 依赖已在 `packages/ws-replication/package.json`（dependencies 含 `@deepseek-ai/cordis-plugin-timer ^1.1.3`），farm 按 overlay 链接（`run-baseline.mjs:254`）；插桩纪律锚点 `cordis-root-real-timer.test.ts:58–97`（beforeAll patch `prototype.timeout`）属实；denied-merge 风险已被 §8.2「explicit-stop 服务仍注册」与「谓词轮询+deadline 禁 sleep」显式排除 |
| 3 | AC3/AC4 落点 | **pass** | A3-1 `issue270-regression-anchors.test.ts:99–142`（事件索引单调断言实存）；A3-3 `registry-sa7-rev1.test.ts:396`（R5P 名实存）；A3-5 `persistence-drain-shutdown.test.ts:112`（确为 `persistence-drain-budget-exceeded` 唯一既有测试观察者）；A4-4 `profile.ts:105–109`（`await persistence.dispose(); await ctx.fiber.dispose()` 序+幂等 `disposed` 标记）；A4 蓝本 `third-party-composition-red.test.ts:28–70`（根 ctx `new TimerService(ctx)` 装配序逐字对应） |
| 4 | AC1/AC5 与机械 gate | **fail（F-2 G10 算法）** | 误判排除（`ctx.rootValue`/`ctx.root('hub',…)`/`root:` 字段）思路正确且有真实样本（`ws-replication-issue301-…test.ts:624/645/836`、`harness.ts:537`）；但候选模式本身写错（见 F-2）。A5-2 五形态自述、A5-3 4 fixture 零 diff、G11 现树零命中（本会话 grep 全 src 无 `internal/config` 等）、G12 allowlist 形状均可执行 |
| 5 | 验收设施扩展边界 | **fail（F-1 负控 env）** | E1–E7 各 edit point 与现状逐一对上（`run-baseline.mjs:50/:51–64/:67–79/:138–142/:526–564/:556–559/:607–631/:773–780/:802–828/:809–811`）；41 行矩阵算术正确（12 suite+typecheck=13×3+2）；E7 自检可满足（现 manifest 序 `provenance,root-probe,…`）；不构成第二套验真机制（零新 acquire/probe/runner）。但 N-2 的 fault env 传不到新 suite（F-1） |
| 6 | ALLOW/DENY 闭合性 | **pass（附 F-1/F-3 的边界修订诉求）** | AC1–AC9 证据均可在 §12.1 的 9+1 文件内产出（F-1 需在 run-baseline.mjs 增补 edit point——该文件本就在 ALLOW；F-3 需把 interop/结构守卫钉进 suite 常量——同为 ALLOW 内）。未发现「承诺证据必须改 DENY 文件」的硬缺口 |
| 7 | TDD 红灯计划与预算 | **pass** | 证据缺口红 vs 环境红 vs 目标原因红三分（§13.1）可判定；4 个 test-d 红为 `.test-d.ts` lane（`ws-replication-issue421-edge-factory-api.test-d.ts`），新测试全为 `.test.ts`，且 root-test 面按 S4 台账判定——污染路径被隔离；预算 2h 硬顶 + repeat 收敛（D-4）现实 |
| 8 | AC→证据矩阵完整性 | **pass（附 F-3）** | AC8-1 15-project 动态解析属实（根 `package.json:13` 恰 15 project；`run-baseline.mjs:636–641` 动态 parse，无内置副本）；①–⑥ 逐行可定位（unload 双文件、4 fixture、issue422+issue420、guard-proxy 三文件、dsh-profile、composition-root 七文件全部实存）；AC9 的 A9-1…A9-5 分别有 G11/G6+G7+G1′+G12/命令日志承载 |
| 9 | S1–S5 与 OPEN 项 | **pass（附 F-4）** | S5 重钉的「快照内容不变」前提本会话独立复核为真（`git diff 279dba4..d59a4d1 -- <4 个 PUBLIC_ENTRIES>` 零输出）；D-5 防回退盲区推理成立（旧基座下回退 #470 的 plugin.ts 改动会使 diff 变空而 gate 仍绿）；S4 台账法有回退案；OPEN 项（R-1…R-8）均可在实现期闭合 |

---

## 4. 需求覆盖

| Requirement（Issue L21–L29） | Design section | Assessment |
|---|---|---|
| AC1 双形态 Root/timer adapter | §5、§9.1 | 覆盖（A1-1…A1-8 → channel/timers 两文件）；A1-8 的 reauth 旋钮名有事实错（F-6） |
| AC2 3×3×7 矩阵 | §8 | 覆盖（63+6 单元、L. 编码、β/γ） |
| AC3 单向拆卸/watchdog/有界 drain | §10.1 | 覆盖（A3-1…A3-5 各有独立载体，均实存） |
| AC4 Timer 最后释放/非自动边/直接 apply 序 | §10.1 | 覆盖（A4-1…A4-4，含「断言非恒真」可证伪性说明） |
| AC5 legacy 直读零迁移残留 | §9.2 | 覆盖但 gate 算法需重写（F-2） |
| AC6 冻结面回归 | §7.3/§14 | 覆盖但 A6-4/A6-5 载体含违约兜底（F-3） |
| AC7 复用验真夹具 | §7 | 覆盖（E1–E7、G12、A7-1…A7-6 逐条） |
| AC8 三基线 typecheck+点名面 | §14 | 覆盖（15-project 动态解析核实为真） |
| AC9 禁令边界 | §7.3 G11/G12 | 覆盖（现树零命中，gate 可通过） |

非目标未静默扩大：§1.19 明确零生产 diff、不修 4+28 既有红、不做部署。

## 5. Owner评论覆盖

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| （无） | — | Issue #471 无任何评论（简报 `## Comments` 空；SA6 §2 实跑 `gh api` → `[]`） | 需求面 = 9 条 AC + ADR 0035，§14 逐条落矩阵 |

## 6. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| #470 R1/R4/R5/R8/R9 原样继承 | §4 表 | 与 #470 冲突报告 R1–R9 原文一致 |
| R2/R7 扩展（S2） | §12、§15 | 合理：#470 的「恰好 4 fixture」是票级收口；SA6 §3 已同判 |
| R3 显式取代（S1） | §15 | 依据成立：owner L22/L28 + ADR 0035 §5 L92（本会话复读 ADR 原文，行为清单确点名 Hub/Peer/SessionHost 启停与 timer 清理） |
| 4 test-d + 28 环境红如实披露 | §13.0/§16-R6 | 与 `task_issue-470_sa10_spec.md:85`（32=28+4 及机制）逐字对上 |
| `ctx.provide` 双挂原生语义 | §3 | 属实：overlay `reflect.d.ts:35`（B1 与 B3 同文案） |
| SA6 §12 判据为唯一规范来源 | §1 | 成立；但 F-3 显示设计在 A6-4/5 处给出了违反该来源的兜底选项 |

## 7. 设计内部一致性

- **行锚点核对**：设计引用的源码行号抽查全部命中（`plugin.ts:200–298/244–298/248–263/269–271/508–514/581–587/675/703–708/761/783`、`run-baseline.mjs:50/51–64/67–79/138–141/526–564/556–559/739–769/773–780/802–828/809–811`、`gates.mjs:41/50–57/109–118`、`vitest.config.ts:15`、`profile.ts:43–109`、`service.ts:86`、`hub-namespace.ts:1050`、`hub-connection.ts:179`、`issue270-…:99–142`）。`base` 字段「文档性」论断核实为真（gates.mjs 用自有 `BASE` 常量；provenance 测试类型含 `base: string` 但只读 `.baselines[id]`）。
- **不一致点 1（F-1）**：§7.2:149 宣称 `runFault`「原样复用」，但 §11 N-2（:287）承诺 `NOMICORE_CORDIS_FAULT=legacy-shim` 经「runner 既有 `extraEnv` 路径」传入新 suite——该路径仅存在于 root-probe 分支（`run-baseline.mjs:584`），通用分支（:540–548）不传 `extraEnv`。
- **不一致点 2（F-2）**：§9.2 候选模式与自身规则 2 的示例互斥（详见错误与恢复攻击）。
- **不一致点 3（F-3）**：§14:385 为 interop/结构守卫提供「或默认布局留证」选项，违反其自称唯一规范来源 SA6 §12.6 失败判定（「只在默认布局跑 guard-Proxy / interop」即不通过）。
- **不一致点 4（F-5）**：单元名计账口径三处不齐（D-7:102 基线标签嵌名、§8.1:194 `L.<entry>.<scenario>` 无基线段、E5:145「前缀 `L.` 归类」、§13.2:356「69 个单元名（三基线并集）」）。
- §17 评审修订映射、§18 `requiresConflictRecheck=true` 自评与 S1–S5 的五项修订面自洽。

## 8. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| C-1 | plugin 已 provide 服务 | fiber `dispose()`（不先 `stop()`） | 有序 effect 反向 yield：drain 先于撤销（`plugin.ts:581–587/673–678/781–786`） | 无——§8.2 fiber-dispose 场景断言「先 stop 后 revoke + pending=0 + 零 unhandled」与源码语义一致 | — |
| C-2 | `timer.ctx === null` 畸形宿主 | apply | loud fail 不回落（`plugin.ts:247`） | 无——§9.1 A1-6 三态与 `:269–271` 逐条对上 | — |
| C-3 | 同 ctx 未撤销二次 apply | remount | `ctx.provide` 抛（三基线同语义） | 无——N-5 有正/负并列用例防「从未双挂」假绿 | — |
| C-4 | timer 触发与 `stop()` 竞态窗口 | 触发前/后 stop 两路径 | 事件序可观测、pending 归 0 | 无——§8.2 竞态纪律（闸门/observer 拉开、两路径都记）承接 SA6 §7 | — |
| C-5 | repeat=3 内 meter 原型插桩 | 跨文件/跨 repeat | patch 不串扰 | 无——runner 逐文件顺序进程（`maxWorkers:1`、每 repeat 独立 vitest 进程），`afterAll` 还原 | — |

## 9. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| F-1 | `--fault legacy-shim --suite root-probe --suite ws-cordis-channel`：负控 env 不达新 suite | `runSuite` 通用分支（`run-baseline.mjs:540–548`）调 `runVitest` 不传 `extraEnv`；仅 root-probe 分支（`:584`）注入 `NOMICORE_CORDIS_FAULT`。外层 `runFault`（`:746–768`）只要任一内层 cell fail 即 exit 0 | **伪证明**：fault JSON 会显示 `ws-cordis-channel: pass`（未受 shim 污染），N-2 承诺的「通道断言红（legacy 缺席断言不能被 shim 蒙混）」从未发生，SA6 §6.2-2 的负控义务落空；且按 §7.2:149「runFault 原样复用」的字面，实现者修此点的 runner 编辑不在 E1–E7 闭合边界内 | **MAJOR**：§7.2 增补 edit point（如 E4a：通用/新 suite 分支镜像 `:584` 的 `extraEnv: fault==='legacy-shim' ? {NOMICORE_CORDIS_FAULT:'legacy-shim'} : {}`），并把 N-2 的通过判定改为「**每个**目标 suite 的 cell 各自 `observed=fail`」而非法「外层 exit 0」 |
| F-2 | G10（A5-1）分类算法按原文不可实现且漏判 | §9.2:248 候选模式 `\.([A-Za-z_$][\w$]*)\.root\b(?![\w$])` 要求接收者自身以点为前缀（两段链，如 `timer.ctx.root`）——裸 `ctx.root`（A5-1 的首要目标形态）**永不成为候选**，与设计自己规则 2 的示例 `ctx.root('hub', nsId, 'blurb')`（:251）及 N-6 注入样本 `const r = ctx.root;`（:291）矛盾；规则 1 分类 `Reflect.get(<host>,'root')` 括形，但候选模式（成员读取 + `\[['"]root['"]\]` 下标形）从不产生该形态 → 「gate 自校验须对两 seam 文件各产生 ≥1 个第 1 类候选」（:256）按原文不可满足；若实现者放宽为匹配 `'root'` 字面量，则 4 具名 fixture 既有双读 helper（`ws-replication-plugin.test.ts:19`、`ws-replication-issue299-ac-red.test.ts:171`、`ws-replication-issue422-listen-false.test.ts:39`）落入第 6 类 → gate 红，与 A5-3「4 fixture 零 diff 且通过」矛盾（allowlist :250 只列 service.ts/plugin.ts +「新通道测试」）；漏判面：解构 `const { root } = ctx`、可选链 `ctx?.root` 完全不在候选集 | **MAJOR**：A5-1 失败判据明文禁止「放行真直读」（SA6 §12.5） | **MAJOR**：重写 §9.2 候选集为可执行清单：单段成员读 `recv.root`（接收者任意、含可选链 `recv?.root`）、下标 `recv['root']`、解构 `const { root[: alias] } = recv`、`Reflect.get(recv,'root')` 括形字面量；规则 1 允许清单显式加入上述 3 处既有 fixture 双读行 + 新通道测试；保留两类自证伪（seam 文件须产生第 1 类命中；N-6 注入须红）——现有自校验设计良好，修正模式后即真正生效 |
| F-3 | AC6-A6-4/A6-5 载体含违约兜底 | §14:385「interop/结构守卫经 `replication-lifecycle` cell 内嵌套运行**或默认布局留证**（实现时以最小可靠面定…）」 | SA6 §12.6 失败判定明文：「只在默认布局跑 guard-Proxy / interop」即不通过；设计以 SA6 为唯一规范来源（§1:5），却内置一个必然不合规的取选项，实现者按「最小可靠面」自由裁量可能产出无效证据 | **MAJOR**：删去「默认布局留证」选项；把 `ws-replication-issue246-interop-matrix.test.ts` 与 `issue418-edge-session-split-{contract,structure}.test.ts`（文件均实存）钉进具名 suite 的文件清单常量（`run-baseline.mjs` 常量改动在 §12.1 ALLOW 内，§14 脚注已授权此类微调） |
| F-4 | 实现期矩阵 cell 因生产行为判红（8/12 timer 族从未在任何基线被探针覆盖：auth/upgrade、close/drain、reauth、bulk-ACK、reconcile、watchdog、waitForLive、assembly——SA6 §5.2 G4） | §5:86 反向闸门：停 cell、留红证据、上报 Controller 走 §5 增补 + 再派发；§16:460 又表述为「新开缺陷票」 | 闸门本身可用（不是死锁：有明确上报与设计修订通道），但 (a) 两条出口表述不一致；(b) plugin.ts 收紧为 DENY 后，每次真缺陷都要一轮完整 Controller 往返 | **MINOR（建议）**：统一出口表述为单一路径；并在 §15 S2 预授权快速通道——Controller 可按 SA6 §18.2 S2 原文（「`plugin.ts`（如需修缺陷时才允许）」）修订 ALLOW，无需重跑完整诊断轮 |
| F-5 | 单元名计账口径不一致 | D-7:102「基线标签嵌入测试名（`L.hub-listen.timer-fired`，缺 env 时 `default.*`）」↔ §8.1:194 编码 `L.<entry>.<scenario>`（无基线段）↔ E5:145「从 testNames **前缀** `L.` 归类」↔ §13.2:356「testNames 含 **69 个单元名（三基线并集）**」 | 若按 §8.1（名不含基线），三基线名字并集恒为 23，§13.2 的 69 判据不可满足；若按 D-7（describe 承载基线标签），E5 的「前缀 `L.`」归类落空（全名以 `B1 >`/`default >` 开头） | **MINOR**：统一为一种口径（建议：describe 标签 = `NOMICORE_CORDIS_BASELINE ?? 'default'`，测试名 `L.<entry>.<scenario>`；E5 归类改为「含 ` > L.` 段归类」；§13.2 改为「每基线 cell 各 23 单元名、三 cell 并列留证」） |
| F-6 | A1-8 reauth 旋钮名不存在 | §9.1:234 写「`reauthTimeoutMs` 族」 | 全仓零 `reauthTimeoutMs`；reauth deadline 实以 `closeTimeoutMs` 武装（`hub-edge.ts:356`（drainTimeoutMs 载体）、`:363–364`（arm delay））；TIMEOUT_KEYS（`plugin.ts:182`）亦无该键。按「arm（delay===配置值）」三段断言写测试会结构性无法命中 | **MINOR**：把该行旋钮改为 `closeTimeoutMs`（与 close/drain 行同键、以触发路径 `requestReauth` 区分两族） |
| F-7 | G3「零 diff 断言」与 untracked 报告语义冲突 | §7.3:156 对 `packages/ws-replication` 改「零 diff 断言」，但 §12.1 允许在该路径下新增 4 个未跟踪测试文件，而 gates 的 `changedPaths`（`gates.mjs:109–118`）显式并集 untracked 文件 | 严格按 `assertNoChange` 实现会在新文件上自我引爆；实现者若擅自改为 tracked-only diff 则弱化既有「strict superset」纪律且偏离已声明边界 | **MINOR**：G3 明示为 `assertAllowlist`（allowed = §6.2 的 4 个 ws 新文件），或明示「tracked 路径零 diff + untracked ⊆ 新文件清单」的双判据，写入 §7.3 |

## 10. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| runner CLI（`--all --matrix` 使用者） | 无：行数 24→41、字段扩展、接口零变化；§16.3 调用方矩阵与源码现状（`run-baseline.mjs:802–828`）一致 | `run-baseline.mjs:802–828` | — |
| `--suite` 白名单 | E3 移除 `'ws-package'` 字面量后 `'gates'` 死字面量仍在（`run-baseline.mjs:139` 接受但 `runSuite` 无分支，#470 SA9 已记录） | `run-baseline.mjs:139` vs `:632` | 顺手清理或明示保留（非阻断） |
| 新 ws 测试的模块解析 | 无缺口：`@deepseek-ai/cordis-plugin-timer` 已在 ws 与 yjs-server、dsh-persistence 的 dependencies 声明（farm 只链已声明依赖，`run-baseline.mjs:246–272`），无需动 package.json | 各 `package.json` | — |
| 生产调用方 | 零变化（零生产 diff）成立 | §5 全表复核为真 | — |

## 11. 架构一致性与惯例审查

### 责任归属
| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 双形态 Root 解析 | 包内私有 seam（ADR 0035 §2） | 既有 `plugin.ts:200–298`，零改动 | 正确 |
| 工件验真 | persistence 测试设施单点 | §7 只扩 suite 注册 | 正确（无第二套机制） |
| Timer 生命周期 | Host（组合根） | §10 新断言文件 | 正确（与 hosting 文档/app AGENTS「单条拆卸链」一致） |

### 相似能力对照
| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 通道/定时器测试范式 | `packages/persistence/test/cordis-root-channel.test.ts`、`cordis-root-real-timer.test.ts`（beforeAll patch `TimerService.prototype.timeout`） | 新 ws 三文件复用同款纪律与 helper | 一致 | SA6 §12.1 明示「参考不复制」 |
| suite 注册/回填 | `runSuite` r5p 回填（`:556–559`） | E5 `units` 回填镜像同一先例 | 一致 | — |
| gate 形态 | `assertAllowlist/assertNoChange`（`gates.mjs:120–139`） | G10/G11/G12 新增 + G2/G3 改判 | 一致（G3 需按 F-7 明确判据形状） | — |

### 单一事实源
| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 三基线工件身份 | `baselines.json`（+`provenance-b3.json`） | cell `provenanceDigest/resolvedRealpaths` | 低（E2/E7/G12 守住；integrity/dshCommit/probes 零改动） |
| 已知红清单 | S4 `root-test-known-red.json`（新） | root-test cell `failedUnexpected/disclosure` | 中：台账一旦陈旧会遮蔽同名列真红——设计已以「新增红仍 gate + A8-4 强制披露 + 回退案」缓解，属可接受权衡，交 SA8 裁决 |
| gates 比较基座 | gates.mjs `BASE` 常量 + `baselines.json.base`（文档性） | 快照 `public-surface.base.json` 内容 | 低：S5 重钉后两者同指 `d59a4d1`；快照内容不变已独立复核（4 entry 在 279dba4..d59a4d1 零 diff） |

### 生命周期对称性
| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 每 cell `beforeAll` 建组/原型插桩 | `afterAll` 还原原型 + `fiber.dispose()` + 根 `ctx.fiber.dispose()`（§8.2 尾） | cell 可单点重跑、workspace 每轮重建 | 对称；与 SA6 §7 资源纪律一致 |

### 平行机制检查
| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| ws 包内自建 mini-runner | 既有 runner | 被明确否决（D-2） | 无平行机制 |
| 测试内 helper（meter/宿主工厂） | — | `cordis-baseline-support.ts`（非 `.test.ts`，不被 glob 收集） | 合理：观测助手 ≠ 验真设施（A7 不涉） |

## 12. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| §12.1 9+1 文件闭合、无理由扩张 | 全部新文件承载均有正文锚点；DENY 与正文（零生产 diff、4 fixture 不动、β 冻结）无冲突 | 无 |
| F-1 所需 runner 编辑不在 E1–E7 内 | §7.2:149「零改动面」清单 vs `run-baseline.mjs:540–548/:584` | 增补 edit point（随 F-1） |
| F-3 所需 suite 常量钉死 interop/418 文件 | §14:385 允许实现期在 ALLOW 内改 suite 清单 | 设计正文直接钉死（随 F-3） |
| `follow-up` 掩盖必要项 | 未发现：4+28 既有红披露义务（A8-4）与不修承诺（§1.19）一致 | 无 |

## 13. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1（A1-1…A1-8） | channel/timers 文件 + 三基线 cell JSON | A1-8 reauth 旋钮名错误（F-6） | 随 F-6 |
| AC2 | `L.*` 63+6 单元、`units` 回填、`L.coverage` 自检 | 计账口径不齐（F-5） | 随 F-5 |
| AC3/AC4 | 既有 app 测试进 cell + 新所有权文件 | 无（断言非恒真性有说明；载体全部实存） | — |
| AC5 | G10 + 5 形态 + 4 fixture 零 diff | G10 算法（F-2）、G3 判据形状（F-7） | 随 F-2/F-7 |
| AC6 | guard-proxy suite + G5 + contract ×3 | A6-4/5 载体兜底违约（F-3） | 随 F-3 |
| AC7 | diff scope + 41 行 matrix | 负控 env 断链使 A7-6「红即 exit≠0」的『红』来源失真（F-1） | 随 F-1 |
| AC8 | 动态 15-project + ①–⑥ 行 | 无（全部核实为真） | — |
| AC9 | G11/G12/G6/G7/G1′ + 命令日志 | 无 | — |
| 负控 N-1…N-6 | §11 表 | N-2 机制断链（F-1）；其余（N-1 materialize 级 fault 经 `faultOverrides` 对全部 suite 生效、N-3 副本变异、N-4 sentinel、N-5 双挂、N-6 gate 注入）机制成立 | 随 F-1 |

## 14. Required revisions

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| F-1 | MAJOR | 设计 `:149`、`:287`；源码 `run-baseline.mjs:540–548`（通用分支无 `extraEnv`）、`:584`（仅 root-probe 注入）、`:746–768`（外层 exit 0 ⇔ 任一内层 fail） | N-2 负控的 fault env 到不了新 suite；fault 证据将以 root-probe 单独红蒙混过关，违反 SA6 §6.2-2 | §7.2 增补 edit point 把 legacy-shim `extraEnv` 线入通用/新 suite 分支；N-2 通过判定改为逐 suite `observed=fail` | `evidence/B3/fault-legacy-shim.json` 中 `cells[]` 每个 suite 均 fail；外层 exit 0 |
| F-2 | MAJOR | 设计 `:248–256`、`:251`、`:291`；源码 `ws-replication-plugin.test.ts:19`、`ws-replication-issue299-ac-red.test.ts:171`、`ws-replication-issue422-listen-false.test.ts:39`、`plugin.ts:231/:251`、`service.ts:66/:86` | G10 候选模式漏掉裸 `ctx.root`（与自身规则 2 示例/N-6 样本矛盾）、规则 1 为死规则、allowlist 漏 3 处既有双读、解构/可选链漏判 | 按 §9 F-2 行重写候选集与 allowlist；保留两类自证伪 | 两个 seam 文件各产生 ≥1 第 1 类命中；N-6 注入 `const r = ctx.root;` 与 `const { root } = ctx;`、`ctx?.root` 样本均定向红；4 fixture 零命中第 6 类 |
| F-3 | MAJOR | 设计 `:385`；SA6 契约 `:355`（§12.6 失败判定） | AC6-A6-4/A6-5 提供「默认布局留证」兜底，与自认规范来源的失败判据冲突 | 删兜底；issue246 + issue418 两结构守卫钉进具名 suite 文件清单（ALLOW 内常量改动） | §14 该行只余三基线 cell 载体；`--all --matrix` 含其三行且绿 |
| F-4 | MINOR | 设计 `:86` vs `:460`；SA6 契约 `:134`（G4：8/12 timer 族无基线证据） | 反向闸门出口双表述；真缺陷修复需完整往返 | 统一出口；S2 预授权 Controller 按 SA6 §18.2 S2 原文快速修订 ALLOW | §5/§16/§15 三处表述一致 |
| F-5 | MINOR | 设计 `:102/:145/:194/:356` | 单元名计账三口径不齐，E5/§13.2 二者必有一处落空 | 统一口径（describe 承载基线标签 + ` > L.` 段归类 + 每 cell 23 单元） | E5 回填与 §13.2 绿灯判据在同一命名方案下可同时满足 |
| F-6 | MINOR | 设计 `:234`；源码 `hub-edge.ts:356/:363–364`、`plugin.ts:182` | reauth 旋钮名不存在 | 改为 `closeTimeoutMs`，以 `requestReauth` 触发路径区分族 | A1-8 表 12 行旋钮全部与 TIMEOUT_KEYS/BACKOFF_KEYS 或实际读取点一一对应 |
| F-7 | MINOR | 设计 `:156`；源码 `gates.mjs:109–118`（changedPaths 并集 untracked） | G3「零 diff 断言」会在 ALLOW 新文件上自我引爆 | 改为 allowlist（allowed=4 个 ws 新文件）或双判据并写入 §7.3 | 新文件在场时 G3 PASS、回退 plugin.ts/改既有测试时 G3 FAIL |

## 15. Non-blocking observations

1. **G6 whitespace 检查不带 BASE**（`gates.mjs:372` `git diff --check` 无基座）：#470 SA9 S9-M3 已记为 MINOR；本票 G6 声明零改动——建议在动 gates.mjs 时顺手改为 `git diff --check <BASE>`，或在 §7.3 明示维持现状的理由。
2. **`--suite gates` 死字面量**（`run-baseline.mjs:139` vs `:632`）：E3 改白名单时顺手清理或注释保留意图。
3. **G12 对三个设施文件的内容盲区**：G12 只管「哪些文件可 diff」，不约束 gates.mjs 被弱化（如删 G10）。N-6 的 scratch 注入证伪是人工步骤；可考虑在 gates.mjs 内建 `--self-test` 模式使该证伪机械化。当前由 SA4/SA7 复核兜底，可接受。
4. **root-test 行为 cell 的 `diagnostics` 字段**：§16.2 说环境红「cell `diagnostics` 留痕」，但行为 cell 的 `baseCell`（`run-baseline.mjs:485–498`）无该字段——实现时按需增字段即可，属实现细节。
5. **D-7 与 root-test 收集面**：新测试默认布局必绿的自我约束正确且必要（根 `vitest.config.ts:15` glob 会收集 `packages|apps/*/test`；root config `passWithNoTests: true` 不影响），设计已把 env 条件断言限定在 RUNNER_MODE，判断成立。
6. **S4 台账的遮蔽面**：台账法会把 32 个已知红名字上的「未来真红」一并遮蔽到台账刷新为止。设计已以「新增红仍 gate + disclosure + SA8 追认/回退二选一」诚实处理；本评审认同提交 SA8 裁决而非在设计中预设结论。

## 16. 复审方式说明

本评审以仓库事实独立核验设计的全部可核验断言（源码行锚点、文件存在性、runner/gates 机制、依赖声明、#470 证据、ADR/协议文本），未修改任何设计、测试或生产文件；唯一写入产物为本文件。F-1/F-2/F-3 修订后建议只做增量复审（三个 finding 的接受条件均已给出可机械验证的判据）。

---

## 17. 增量复审（iteration 1：528 行定向修订版）

### 17.0 Reviewed inputs 与方式

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-471_design.md`（528 行，iter 1 定向修订版；§17 自称 F-1…F-7 逐条闭合） | 已全文实读，重点 §5/§7.2 E4a/§9.1–9.2/§11 N-2/§12/§14/§17 |
| `wiki/raw/task_issue-471_design_conflict_report.md`（SA8，verdict=clear；§9.1 十文件 ALLOW、§9.2 T-1…T-4、B-1…B-5、§9.3 十二条交付条件） | 已全文复读，作为约束性基线逐条对照 |
| `git rev-parse HEAD` = `d59a4d1…` | 与设计基线一致（复核） |
| 源码/设施第一手重验（本轮新增）：`runVitest`（`:383–440`，`extraEnv` 选项 `:384/:404`，`testNames = assertion.fullName ?? title`）、`runSuite` 三个既有 `runVitest` 调用点（`:542` 通用 / `:581–585` root-probe（`:584` 已注入 fault env）/ `:614` ws-package）、`runFault`（`:739–769`：`fault` 作参数传入 `runSuite`；payload `cells[]` 逐 suite `status`；`--fault` 禁 root-test/typecheck `:845`）、`cordis-root-channel.test.ts:441–472`（F9 纪律：读 env + 同一受控 ctx `defineProperty` + 严格断言）、`service.ts:86`/`plugin.ts:251`（`safeReadChannel(host,'root')`，全仓唯二生产 seam）、3 处 fixture 双读行（`ws-replication-plugin.test.ts:19`、`issue299-ac-red:171`、`issue422-listen-false:39`）、`root-probe.mjs:104/:119/:124/:134`、TIMEOUT_KEYS/BACKOFF_KEYS（`plugin.ts:182/:183`）、`hub-connection.ts:173–183`、`hub-edge.ts:356/:363–364`、`hub-namespace.ts:1050`、`fence-watchdog.ts:8/:50`、`plugin.ts:761`、`gates.mjs`（`changedPaths :109–118`、`assertAllowlist :128–139`、现行 G2 `:392`/G3 `:398`）、guard-proxy 六文件与 issue420/registry-sa7-cordis 等全部新钉 suite 成员在盘核验、**G10 候选形态全仓扫描**（736 文件面：M1 `\.root\b`、M2 `['root']`、M3 解构、M4 `'root'` 实参） | 本会话独立核验 |

复审方式：逐条核对上轮 §14 F-1…F-7 的 Acceptance 列（不复读已核验为真的骨架）；对修订 delta 做新风险审查。未修改任何设计、测试或生产文件。

### 17.1 Verdict（本轮）

**reject**（1 项 MAJOR：**F-8**——重写后的 G10 候选集在现树上「出生即红」）。F-1/F-3/F-4/F-6/F-7 五项已按上轮判据闭合，从阻断清单移除；F-5 主体闭合、余一句级残留（MINOR，F-5r）。F-8 是本轮修订新引入：上轮 F-2 修复把候选集从「过窄」（裸 `ctx.root` 永不成候选）摆到「过宽」（任意接收者的域对象 `root` 字段读取全部入网），未被 §17 F-2 行的四条验收锚点探测到。修订仍为局部（§9.2 候选集语境限定 + 允许清单补 `root-probe.mjs`），不动摇骨架。

### 17.2 F-1…F-7 逐条核验（对照上轮 §14 Acceptance 列）

| # | 上轮 Acceptance 判据 | 修订落点 | 仓库事实核验 | 结论 |
|---|---|---|---|---|
| **F-1** | `evidence/B3/fault-legacy-shim.json` 的 `cells[]` 每个 suite 均 fail；外层 exit 0；fault env 线入新 suite 的 edit point 落在闭合边界内 | §7.2 新增 **E4a**（`:163`）；§7.2 零改动面段（`:168`）显式消解 `runFault`「原样复用」冻结；§9.1「通道文件的 fault 消费纪律」（`:265`）；§11 N-2 判定升级（`:318/:324`） | ①三个既有 `runVitest` 调用点行号全中（`:542/:584/:614`），`runVitest` 支持 `extraEnv`（`:384` 解构、`:404` 合入 env），`fault` 本就是 `runSuite` 第五参——E4a 无需改签名即可实现；②`runFault :739–769` payload 的 `cells[]` 逐 suite 带 `status` 字段——N-2「每个 suite `status:'fail'`」有既有载体，顶层 `observed` 被显式声明不构成证据；③F9 纪律核实（`cordis-root-channel.test.ts:441–472`：`fault` env → 同一受控 ctx `defineProperty(ctx,'root',…)` → `expect(legacy).toBeUndefined()` 在 B3 定向红）——新 channel 测试镜像该纪律即把 fault 证据真拴到新 suite；④泄漏面：无 `--fault` 时 `runSuite(…, undefined)` → `extraEnv {}`，且 `--fault` 禁 root-test/typecheck 车道（`:845`）——env 不达非 fault 运行 | **已闭合** |
| **F-2** | 两 seam 各 ≥1 第 1 类命中；N-6 三注入定向红；4 fixture 零第 6 类；候选集覆盖裸 `ctx.root`/解构/可选链 | §9.2 全节重写（M1–M4 四形态 `:271–274`、六类分类 `:275–282`、扩展允许清单 `:276`、自证伪 `:284–285`、回归样本自检 `:286`） | 四条锚点逐条为真：seam 自校验经 M4 可满足（`service.ts:86`/`plugin.ts:251` 即 `safeReadChannel(host,'root')`，全仓唯二）；3 处 fixture 双读已入允许清单（`:19/:171/:39` 逐字核实）；N-6 三注入形态分落 M1/M3/M1→第 6 类；4 fixture 命中实分落第 1/3 类（`Symbol.for('cordis.root')` 字符串内容、computed key），issue301 `ctx.root(` 落第 2 类。**但候选集 M1–M3 对接收者零限定，把全仓域对象 `root` 字段读取整体卷入第 6 类**（详见 F-8） | **未闭合（新 MAJOR F-8）** |
| **F-3** | §14 该行只余三基线 cell 载体；`--all --matrix` 含其三行且绿；兜底全删 | §14 AC6-A6-4/A6-5 行（`:418`）重写 + 归置钉死脚注（`:433`）；§7.2 E1/E5（`:159/:164`）；§7.4 guard-proxy 六文件（`:189`）；§4.1 B-4 行（`:77`） | 六文件全部在盘（clock/registry/ws guard-proxy 三消费 + issue246（4 用例）+ issue418-contract（17）+ issue418-structure（9）——用例量级与设计自述「4/17/9」逐字一致）；「默认布局留证」字样全删（§14 只余三基线 cell；脚注明示调整只准改 `run-baseline.mjs` 常量且不得回退兜底形态）；12-suite/41 行算术不受影响（guard-proxy 复用既有 suite 名，未加第 13 个：13 cell×3+gates+root-test=41）；B-4 逐字吸收（§4.1/§15-S5） | **已闭合** |
| **F-4** | §5/§15/§16 三处表述一致；真缺陷修复通道不构成绕零 diff 义务的缺口 | §5 反向闸门（`:104`）单一出口 + §15 S2 预授权快通道（`:442`）+ §16.4 回退边界（`:493`） | 三处逐字同口径（停 cell→留证→上报；Controller 按 SA6 §18.2 S2 修订 ALLOW 后另派修复；修复回同一验收面）。快通道引用核实：SA6 契约 `:522` 原文确含「`ws-replication/src/plugin.ts`（如需修缺陷时才允许）」。**缺口攻击面结论：不构成许可证**——实现者侧禁令是绝对的（「不得就地修 `src/**`」），ALLOW 修订权在 Controller 且以 SA6 原文为据、修复另派并回到 A1 断言+重钉 gates+cell 复跑绿的同一验收面；SA8 §9.3-10 交付条件独立审计「未就地修」执行记录。快通道省掉的只是诊断轮，不是 ALLOW 修订与审计 | **已闭合** |
| **F-5** | E5 回填与 §13.2 绿灯判据在同一命名方案下同时可满足（每 cell 23、三基线并集 69） | D-7（`:120`）、§8.1（`:214`）、E5 归类规则（`:164`）、§13.2（`:389`）四处统一：describe 标签 = `NOMICORE_CORDIS_BASELINE ?? 'default'`、测试名 = `L.<entry>.<scenario>`（名内无基线段）、全名 = `<标签> > L.…` | 方案自洽且机械可承载（`runVitest` 取 `assertion.fullName`，vitest 全名即 ` > ` 连接）：三 cell 全名因基线段互异 → 并集恰 69；issue420 等非 `L.` 名不冲击 units。**残留（F-5r）**：E5 归类子句「取**以 `L.` 起头**的段」按字面把 §8.1/§14 钉名的自检 `it('L.coverage')` 也计入（它同样以 `L.` 起头、含 ` > L.` 段）→ 字面读法 observed=24≠23，T-1/§13.2 钉死谓词不可满足；按 `<entry>.<scenario>` 三段形状读法才得 23。需一句显式排除 | **主体闭合，余一句级残留（MINOR）** |
| **F-6** | 12 行旋钮全部与 TIMEOUT_KEYS/BACKOFF_KEYS 或实际读取点一一对应，无凭空旋钮 | §9.1 表（`:248–263`）reauth 行改 `closeTimeoutMs`、auth/upgrade 行改 `helloTimeoutMs`、表后旋钮对应验收（`:263`） | 逐行重验：TIMEOUT_KEYS（`plugin.ts:182`）恰含 hello/open/bootstrap/reconcileTimeout/reconcileInterval/close/ack/pingInterval/pongTimeout/assembly 十键、BACKOFF_KEYS（`:183`）= baseMs/maxMs/resetAfterMs——11 行键载体（hello、auth=`helloTimeoutMs`（`hub-connection.ts:173–183` 注释+arm 点核实，确非 `openTimeoutMs`）、bootstrap、close/drain、reauth=`closeTimeoutMs`（`hub-edge.ts:356` GOAWAY drainTimeoutMs 载体 + `:363–364` arm delay 核实）、backoff、bulk-ACK、reconcile、liveness、watchdog=`ackTimeoutMs`（`fence-watchdog.ts:8/:50`）、assembly）全部在键集内；1 行字面量读取点（`plugin.ts:761` `timer.setTimeout(check, 25)` 核实）。无悬空旋钮名残留 | **已闭合** |
| **F-7** | 新文件在场 G3 PASS、回退 `plugin.ts`/改既有测试 FAIL（判据形状落 §7.3） | §7.3 G2/G3 拆分（`:176`）：G2 = `assertNoChange`（三处 src）、G3 = `assertAllowlist`（allowed = §6.2 的 4 个 ws 新文件）+ 等效双判据明文 | `changedPaths`（`gates.mjs:109–118`）= tracked diff vs BASE ∪ untracked：新文件在场 → untracked ⊆ allowed → PASS；回退 `plugin.ts`/改任何既有 ws 测试 → tracked diff 不在 allowed → FAIL——双判据成立。G2 三处 src（persistence/dsh-persistence/namespace-registry）下本票无新文件，`assertNoChange` 不自引爆；`assertAllowlist` 既有形态在 `:128–139`。G6 挂基座（`:372`）为列明编辑点 | **已闭合** |

### 17.3 修订引入的新风险审查（dispatch 项 2）

| 攻击面 | 核验 | 结论 |
|---|---|---|
| E4a 把 fault env 泄漏到非 fault 运行 | `fault` 仅经 `runFault → runSuite` 参数链在场；无 `--fault` 时全链 `undefined` → `extraEnv {}`；`--fault` 模式禁 root-test/typecheck（`run-baseline.mjs:845`）；不读该 env 的 suite 收到亦无害（设计自述且唯一消费者为通道测试）；默认布局（root-test 收集面）无该 env → D-7 正控不受影响 | 无泄漏 |
| suite 钉死隐式扩张 ALLOW | guard-proxy 六文件/issue420/registry-sa7-cordis 等全是**执行**既有 DENY 文件而非修改：§12.1 仍恰 10 文件 = SA8 §9.1，DENY 面零变化；归置调整被脚注限定为只准改 `run-baseline.mjs` 常量（ALLOW 内）且回 SA8 | 无扩张 |
| G10 新候选集误判 | 见 F-8：误判面不是「漏」而是「过捕」——约 150+ 域 `root` 读入第 6 类，含 6+ 生产 src 文件与允许清单外的探针本体 | **MAJOR（F-8）** |
| L. 计账边界 | 见 F-5r：`L.coverage` 自检名被字面前缀规则计入 | MINOR |
| guard-proxy 六文件 repeat=1 预算 | §13.3 已列（≈5–10 min）；三文件用例量 4/17/9 属实；issue246/418 首次进 B2/B3 workspace 属 R-1 同类环境风险，已有环境红分类与 §5 闸门承接（若真为行为红恰是 A6-4 要抓的信号） | 可接受 |

### 17.4 Required revisions（本轮）

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| **F-8** | **MAJOR** | 设计 §9.2 `:271–274`（M1「接收者不要求自身带点」零语境限定）、`:282`（通过判定「第 6 类为空」）、`:276`（允许清单）；本会话全仓扫描（736 文件面）：M1 生产 src 命中——`namespace-registry/src/registry.ts`（14 处，如 `:711 record.root`、`:1472 payload.root`、`:1506 p.root`）、`vfsl/src/schemasource.ts:139/:173`（`scanDomains(this.root)`）、`doc-runtime/src/create-initial-document.ts:150/:154/:178` 与 `schema-replace.ts:224/:234`（`input.root`）、`apps/yjs-server/src/app.ts:384/:864/:880`、`config.ts:379`（`entry.root`/`args.root`）；M2——`namespace-api/src/request-body.ts:139`（`record['root']`）、`namespace-runtime/src/schema-write.ts:383`；M4——`create-namespace.ts:292`（`'root'` 实参）、`request-body.ts:131`（`hasOwnProperty.call(record,'root')`）；测试面 ~150 处（`doc-runtime/test/issue-348` 64、`issue-350` 19、`vfsl/test/schemasource-seam` 18、`issue-347` 15、registry 族 ~15）；M3——`namespace-diagnostic-log/test/file-adapter-sa7-dynamic.test.ts` ×10（`const { root, ns } = freshRoot(…)`）；**允许清单外的探针本体 `root-probe.mjs:104/:119/:124/:134`（M4×3 + M1 `Context.root`）** | 上述命中均非第 2–5 类（非 helper 调用、非字符串内部、非定义位、非注释）且不在第 1 类允许清单 → 全落第 6 类 → **G10 在 BASE 现树出生即红**，§13.2「gates 12/12」与 SA8 §9.3-2 按设计原文不可满足；T-2 又把 M1–M4 与允许清单钉死为实现 diff 不得偏离的值——实现者既不能收窄候选（越权）也不能批量扩清单（须回 SA8），按原文无法交付。根因：M1 从「两段链」放宽到「任意接收者」时未限定 Cordis Root 语境，而 AC5（Issue L25）的迁移对象只是「Host fixtures 的 legacy Root 直读」；域对象同名 `root` 字段（Yjs 文档根、schema root、namespace 记录 root 键、探针 `Context.root` 静态）被整体卷入。§17 F-2 行的四条验收锚点（seam/3 双读/N-6/4 fixture）恰好都不在这片域上，故未被自检发现 | §9.2 候选集限定到 Cordis Root 语境：建议 M1–M3 只扫描 import/引用 Cordis `Context`/`TimerService`/`@deepseek-ai/cordis*` 的文件（与 AC5「Host fixtures」同 scope；两 seam 文件保持在内以保第 1 类自校验），M4 保留全局但仅 `'root'` 实参形态；把 `root-probe.mjs`（SA6 A5-1 允许类②「专用 Root 通道探针」）加入第 1 类文件级允许清单；回归样本自检增补域样本（`record.root`、`fx.root`、`const { root } = freshRoot(…)`、`Context.root`）断言为非候选/排除类。修订后的允许清单是 T-2 钉死值的新版本，须回 SA8 复核 | 在 BASE `d59a4d1` 现树实跑 G10：第 6 类为空；两 seam 各 ≥1 第 1 类命中；`root-probe.mjs` 命中落第 1 类；N-6 三注入（`const r = ctx.root;`/`const { root } = ctx;`/`ctx?.root`）仍定向红；4 fixture 零第 6 类；域样本（registry.ts / doc-runtime / vfsl-seam / diagnostic-log 各取一）判定为非候选或排除类且理由留痕 |
| **F-5r** | MINOR | 设计 `:164`（E5「取以 `L.` 起头的段归类——即『含 ` > L.` 段』或全名以 `L.` 开头』）↔ `:214`（§8.1 钉名自检 `it('L.coverage')` 且 21+2=23）↔ `:389`/T-1（`observed===23` 钉死谓词）；`runVitest` 取 `assertion.fullName`（`run-baseline.mjs:429`） | 字面前缀规则把 `L.coverage` 也计入 → observed=24≠23，钉死谓词按字面不可满足；实现者须在「永红」与「偏离字面规则」间自由裁量——恰是 F-5 要消除的裁量面 | E5 归类改为「按钉死的 23 个单元名清单归类」或显式排除自检名（「`L.coverage` 不计入 units」），一句修订 | E5 实现后每基线 cell `observed===23` 与 §13.2「三基线全名并集恰 69」同时成立，无需实现者裁量 |

### 17.5 Non-blocking observations（本轮）

1. F-8 修复若采用「Cordis-import 文件面」限定，`harness.ts`/`driver.ts` 等 ws 测试设施会进扫描面（其 `root:` 定义位 `harness.ts:537` 已由第 4 类排除，现状无害）——实现时把该判定纳入回归样本自检即可。
2. §7.2 E4 的通用 cell 可选 `diagnostics` 字段已按上轮 §15-4 落 edit point（镜像 root-test `:729–733` 先例，不参与 pass 判定）——闭环确认。
3. `guard-proxy` suite 语义已从「guard-Proxy 消费」扩为「AC6 冻结面守卫」而沿用旧 suite 名——名实有轻微漂移，但为保 12-suite 算术与 T-1 钉死值的稳定选择，§7.4 已自述理由，可接受。
4. 上轮 §15-1/2（G6 挂基座、`'gates'` 死字面量清理）与 §15-3（G12 内容盲区维持三重防线）的表态均已吸收或说明，无新增诉求。

### 17.6 结论与路由

- **verdict = reject**：仅 F-8（MAJOR）阻断交付；F-5r 随 F-8 一并一句修订。F-1/F-3/F-4/F-6/F-7 闭合，SA8 约束性裁决（十文件 ALLOW、T-1…T-4、B-1…B-5、§9.3）的吸收方式经逐条对照无违例。
- **路由**：SA1 定向修订 §9.2（候选集语境限定 + 允许清单补 `root-probe.mjs` + 域样本自检）与 E5 归类一句；因修订对象含 T-2 钉死值（G10 允许清单/候选集的新版本），**requiresConflictRecheck = true**，修订后回 SA8 复核钉死值新版本，再做 SA2 增量复审（仅 F-8/F-5r 两点）。

---

## 18. 增量复审（iteration 2：594 行第二轮修订版）

### 18.0 Reviewed inputs 与方式

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-471_design.md`（594 行，iter-2 定向修订版；基线 HEAD `d59a4d1` 与设计自述一致，`git rev-parse HEAD` 复核） | 已全文实读，重点 §9.2 rev 2 / §7.2 E5 / §8.1 / §13.2 / §7.5 / §14 / §11 N-1 / §17.2 |
| 本评审 §17（iter-1：F-8/F-5r 判据）与 SA8 `task_issue-471_design_conflict_report.md` §12.8（X-1 五款 / T-1a 四款 / §12.8-3 / §12.8-4 不得回退） | 逐字对照 |
| `.cache/issue471-g10-dryrun/`（`scan.mjs` 全 219 行实读 + `report-main.txt`/`report-n6.txt`/`n6-scratch/n6-g10-scratch.ts`） | **只读复跑两 pass，均与报告逐字节一致**（工作树仅 `wiki/raw/*.md` untracked，扫描面不受污染） |
| 独立复核：扫描面文件数（find 按 R0 口径独立枚举 = **732**，与 `scanned_files=732` 一致）；`cordis_faced` 独立复算 = **45**；分类器行为探针（scan.mjs 辅助函数逐字复制到 `/tmp` 跑 38 条合成样本，未在 `packages/`/`apps/` 内建任何文件）；全仓 grep 检索漏判形态实存性 | 本会话独立核验 |

复审方式：只核验 dispatch 指定的 F-8 接受判据、F-5r/T-1a、不得回退面与 delta 风险；不重开已闭合章节。

### 18.1 Verdict（本轮）

**reject**（1 项 delta 引入的 MAJOR：**F-9**——§9.2 rev 2 的干跑取证脚本与其声称「逐条实现」的 R0–R2 规范存在可证差异，其中 cast 括形接收者解析缺陷把「不可解析 ⇒ 类 6」的 fail-closed 条款静默降级为 5D 排除，且设计自检样本表两条被其自身证据反驳）。F-8 五款判据与 F-5r/T-1a 的**规范文本本身**核验通过（§18.2/§18.3），不得回退面全部维持（§18.4）；阻断点集中在取证工件与规范文的一处机械缺陷，修订成本一句级到数行级。

### 18.2 F-8 接受判据核验（SA8 §12.8-1 (a)–(e) + 本评审 §17.4 判据）

| 款 | 核验 | 结论 |
|---|---|---|
| (a) BASE 干跑第 6 类恰空 | 只读复跑 `node .cache/issue471-g10-dryrun/scan.mjs`：`scanned_files=732 cordis_faced=45`、`cat_1=19 cat_2=13 cat_3=9 cat_5=2 cat_5DR=196 cat_5DC=46 cat_6=0`（合计 285 条），输出与 `report-main.txt` **逐字节一致**；732/45 两数独立复算吻合；两 seam 第 1 类在场（`service.ts:86`/`plugin.ts:251`，M4 callee=safeReadChannel）；4 具名 fixture 零第 6 类（命中实落类 1/3：`ws-replication-plugin:19/34`、`issue299:171/183`、`issue422:39/93`、`guard-proxy:105`） | **成立**（但证据脚本保真度见 F-9——计数的 BASE 值不受 F-9 影响：全树 cast 括形命中仅 2 处且接收者均 ∉ V_ctx） |
| (b) N-6 三注入形态定向红 | 复跑 `--n6`：`cat_6=3`，恰为 `n6-g10-scratch.ts:4 [M1 receiver=ctx]`、`:5 [M3 source=ctx]`、`:6 [M1 receiver=ctx]`（`ctx.root`/解构/可选链），其余计数与主证逐项相同；样本文件零 Cordis 标记（实读 7 行）——F 不门控得证 | **成立** |
| (c) 两 seam 各 ≥1 第 1 类命中（M4） | `report-main.txt` cat 1 首尾两条即两 seam（allowlist callee=safeReadChannel） | **成立** |
| (d) 允许清单零增删 + 词表判别 + ≥4 域族样本 + 不以整文件白名单移出生产监控 | 脚本 `LINE_ALLOW` 恰 5 行（2 seam + 3 fixture 双读行）、`FILE_ALLOW` 恰 2 探针测试文件——与 SA8 §12.2 项 3 追认值（「恰 2 个文件级通道探针许可，不得再扩」）逐项一致；`root-probe.mjs` 经 R0 扫描面排除解决、未新增第三份文件级许可，G12 零 diff 执法为其监控承载（四点理由成立）；自检表 ≥4 域族实际 7 族在场（`payload.root`/`record.root`/`p.root`/`fx.root.get`/`args.root`/`hasOwnProperty.call`/`validationProblemResponse`），报告核实全部落 5D；`registry.ts` 未入任何白名单、其命中逐条记录于 5D-R（`:711/:1472/:1506`）；扫描面排除仅设施目录（无生产文件） | **成立**（自检表两行的机械表述缺陷见 F-9） |
| (e) 全量命中清单输出 | 报告 285 条含排除项与理由（receiver/callee token + unfaced 注记），无静默丢弃 | **成立** |

**漏判面独立核查**（dispatch 指定形态，分类器探针 + 全仓实存检索）：

| 形态 | 实际分类 | 评估 |
|---|---|---|
| `this.ctx.root` / `timer.ctx.root` / `opts.ctx.root` | **类 6**（M1 链式接收者取终端段 `ctx` ∈ V_ctx） | 捕获 ✓ |
| `Reflect.get(host, 'root')` | **类 6**（M4 + V_M4） | 捕获 ✓（非清单文件中响红，不掩盖） |
| `timerRoot.root` | 5D（`timerRoot` ∉ V_ctx） | 词表边界；全树无任何 `*Root` 后缀接收者携带 Cordis root（distinct receiver 扫描为空）， latent |
| `const c = ctx; c.root`（别名） | 5D（`c` ∉ V_ctx） | 词法 gate 固有边界（见观察 O-2） |
| `ctx['ro'+'ot']` / `Reflect.get(host, k)`（k 变量） | 非候选 | 同上；现存 `Reflect.get(host, key)` 实例即两 seam `safeReadChannel` 内部（`service.ts:66`/`plugin.ts:231`）——机制本体非规避 |
| `const { ctx: { root } } = host`（嵌套解构） | 非候选（M3 正则不可解析嵌套括） | latent，全树零实存（见观察 O-1） |
| `const { root } = opts.ctx` / `= timer.ctx` | 5D（M3 源 token 取**首**标识符/整段点链，∉ V_ctx）——与 M1 终端段规则**不对称** | latent，全树零实存（见观察 O-1） |
| `(ctx as any).root` / `(host as Context).root` / `(ctx as X)['root']` | 脚本实跑 ⇒ **5D（receiver=undefined）**；按 §9.2 规范文应 ⇒ 类 6（cast 取首个标识符） | **F-9 主体：证据脚本把 fail-closed 降级为静默排除** |

**过判面**：非 Cordis 语境的 `ctx.root`（数据对象/测试 helper 形参）⇒ 类 6 响红（fail-closed 方向），**不会**被误归第 1 类——类 1 掩盖面恰为 5 行 + 2 探针文件（T-2 钉死），探针文件均为测试文件且其一为尚不存在的新文件、其二受闭合世界 DENY 冻结。`if (key === 'root')` 比较形经 V_M4 被调词表排除（5D-C callee=if），非掩盖。

### 18.3 F-5r / T-1a 核验

| 核验点 | 结论 |
|---|---|
| 23 名枚举（21 个 `L.<entry>.<scenario>`，entry ∈ {hub-listen, peer-dial, session-host} × scenario ∈ {startup, timer-fired, timer-cancelled, explicit-stop, fiber-dispose, service-revoked, remount} + `L.edge-beta.minimal-round` + `L.async-gamma.minimal-round`） | §8.1/§7.2 E5（`LIFECYCLE_UNITS` 常量）/§13.2 三处同源一致；算术 21+2=23、23×3=69 无误 |
| `observed` = 清单内「在场且 passed」去重计数、`missing` = 清单 − 在场、pass 要求 `observed===23` | T-1a-1 逐字相符（§8.1/E5/§13.2/§7.5/§14 AC2 五处一致） |
| 自检定名 `coverage`：非 `L.` 前缀 ⇒ 天然不计入 units、不触 fail-closed；必须在场且 passed（cell 级谓词承载） | T-1a-2「二选一须显式写明」满足——§8.1 显式定名并放弃 `L.coverage`，E5/§13.2/§7.5/§14 同口径 |
| fail-closed：「23 名枚举 ∪ {`coverage`}」之外任何 `L.` 起头单元名 ⇒ cell 红 | T-1a-3 相符（§8.1 全式表述；E5「枚举之外以 `L.` 起头」等价——`coverage` 无 `L.` 前缀） |
| 三基线全名并集恰 69、自检不计入 | T-1a-4 逐字相符（基线段互异使全名互异；`runVitest` 取 `assertion.fullName`，iter-1 已核） |
| 新「自检恒真」风险 | 无：单元被删 ⇒ `coverage` 红（23 名未全出现）且 `observed<23` 红；`coverage` 写成空断言 ⇒ 独立性主张失效但 cell 谓词（observed===23 + coverage 在场且 passed）仍由 runner 承载，双向红保留 |
| 新「枚举与实现脱节」风险 | 无：改名 ⇒ 枚举外 `L.` 名红 + missing 红；`LIFECYCLE_UNITS`（runner）与测试名（测试文件）分属两个 ALLOW 文件，漂移双向可检 |

### 18.4 不得回退核验（SA8 §12.8-4）

| 面 | 设计位置（iter-2 实读） | 结论 |
|---|---|---|
| E-增补授权（E4a/E3 清理/E4 可选 diagnostics；G6 挂基座/G2-G3 形状/F-3 suite 常量钉死） | §7.2 E3（`:161`）/E4（`:162`）/E4a（`:163`）、§7.3 G6（`:175`）/G2-G3（`:176`）、E1 常量（`:159`） | 原样保留 ✓ |
| 十文件闭合 ALLOW / 闭合世界 DENY | §12.1 恰 10 行、§12.2 闭合世界条款（`:401/:405`） | ✓ |
| B-1…B-5 | §4.1 表（`:74–78`）逐条在位 | ✓ |
| T-2/T-3/T-4 | §4.1（`:80–82`）+ §7.3 G12 + §11 N-6 三形态 | ✓ |
| F-1/F-3/F-4/F-6/F-7 闭合 | F-1（E4a + §9.1 fault 纪律 `:265` + N-2 `:374`）、F-3（六文件 `:159/:189/:474/:489`）、F-4（`:104/:498/:549` 三处同口径）、F-6（`:251/:254` 旋钮修正）、F-7（`:176`） | ✓ |
| §12.8-3 N-1 收口 | §11 N-1 行（`:373`）+ 负控纪律段（`:380`）+ §13.2 均为逐 suite `cells[]` 读法 | ✓（§13.1 fault 行残留一句旧括注，见 O-5） |

### 18.5 Required revisions（本轮）

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| **F-9** | **MAJOR** | `scan.mjs:93`（`receiverOf`）与 `:195`（`receiverOfBracket`）：`const inner = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(…)` **无捕获组**却返回 `inner[1]` ⇒ 恒为 `undefined`；下游 `recv === null` 为假（fail-closed 条款被跳过）、`inVctx(undefined)` 为假 ⇒ **5D 静默排除**。探针实证：`(ctx as any).root`、`(host as Context).root`、`(ctx as Record<string,unknown>)['root']` 均落 `5D-R(recv=undefined)`，与 §9.2 R1「cast 括内取首个标识符 / 不可解析 ⇒ 候选 ⇒ 类 6」及 §12.8-1(d)「歧义 fail-closed」直接相反。设计自身证据内的两处反证：`report-main.txt` `schema-write.ts:383 [M2 (receiver=undefined)]` ↔ 自检表期望「5D（receiver=snap）」；`harness.ts:537 [M1 (receiver=opts)]`（M1 matcher **确有触发**）↔ 自检表「类 4——任何 matcher 均不触发 ⇒ 结构性非候选」（该断言按文接入 gate 自检即不可满足）。次要保真差：(i) `inVctx` 用 `/i`（大小写不敏感）↔ 设计「大小写敏感（ctx/Ctx 后缀）」——BASE 零影响（distinct receiver 全集无任何 ctx/context/host 结尾 token）；(ii) `commentSpan` 仅识别 `//` ↔ 设计类 5 含 `*`/`/*` 引导行——JSDoc 行 `* reads ctx.root` 脚本判 6、规范判 5（BASE 零实存，探针证实）；(iii) M3 源 token 取首标识符/整段点链（见 O-1）。**为何 MAJOR**：§9.2 把该脚本定为「R0–R2 的逐条实现」与 SA8 复核命令，(a) 款验收（「实现落地后 gates 首跑必须复现同一结果」）以此为锚；N-6 三注入不含 cast 形 ⇒ 验收锚点探测不到该差异——与 iter-1 F-8 同构的「锚点不在失效域」模式；若 SA3 按规范文实现则 gates 与干跑在 cast 形上行为分叉（BASE 计数侥幸相同），若照脚本实现则 G10 携带静默排除通道出厂 | (1) 修 `scan.mjs`：两处 `inner[1]`→`inner[0]`；`inVctx` 去 `/i`（或改设计文为大小写不敏感，二选一须一致）；`commentSpan` 补 `*`/`/*` 注释行识别；(2) 重跑主证与 `--n6`，计数不变性应逐项成立（cast 命中仅 2 处且接收者 `snap`/`input2` ∉ V_ctx，cat_6 仍为 0；n6 仍为 3）；(3) §9.2 自检表两行按修后机械语义改写（`schema-write.ts:383` ⇒ 5D receiver=snap；`harness.ts:537` ⇒ 5D receiver=opts，其中定义位部分为非候选），并加一句「gates.mjs 的 cast 括形解析取首个标识符、不可解析 ⇒ 类 6」；(4) 在回归自检表补 cast 形断言（`(ctx as any).root` ⇒ 类 6）——若改 N-6 三形态钉死内容则须随 §12.8-1 一并回 SA8 | 修复后复跑两 pass 计数逐项相同（19/13/9/2/196/46/0 与 3）；`(ctx as any).root`、`(ctx as X)['root']` 探针 ⇒ 类 6；`harness.ts:537`/`schema-write.ts:383` 自检断言与报告输出一致；SA8 §12.8-1(a)–(e) 增量追认复核成立 |

### 18.6 Non-blocking observations（本轮）

1. **O-1（M3 源解析与 M1 不对称 + 嵌套解构不捕获）**：M1 链式接收者取终端段（`timer.ctx.root` ⇒ 类 6），M3 源 token 取首标识符/整段点链（`const { root } = timer.ctx` ⇒ 5D）、嵌套解构 `{ ctx: { root } } = host` 非候选——同一直读语义在解构形下逃逸。全树零实存（grep 复核）、生产 src 由 G2/G3 零 diff 冻结，风险 latent。建议：M3 源解析改终端段同款规则，或在 §9.2 显式声明该排除并各配一条回归样本。
2. **O-2（词法 gate 固有边界）**：别名接收者（`const c = ctx; c.root`）、动态下标（`ctx['ro'+'ot']`）、变量键（`Reflect.get(ctx, k)`）不可捕获——任何文本级 gate 共有；G10 威胁模型是「意外重新引入 legacy 直读」（G2/G3 已冻结生产面），可接受。建议设计补一句边界声明，免 SA4 复审时重议。
3. **O-3（V_ctx 排除 `Context` 静态形）**：`(Context as {root?}).root` 类静态观察 ⇒ 5D；全树唯一实存位（`cordis-root-channel.test.ts:463/468`）在文件级许可探针内、设施探针由 G12 零 diff 冻结，属已命名决策（`Context` 不入表），维持。
4. **O-4（G12 判据宜显式含 untracked）**：R0 排除设施目录的理由 (ii)（「监控不丢失，由姊妹 gate 全量承载」）依赖 G12 对该目录**新增未跟踪文件**也红；建议 G12 行显式写「按 `changedPaths`（tracked diff ∪ untracked）执行 allowlist 判定」，使理由闭合。
5. **O-5（§13.1 fault 行残留旧括注）**：`:439` 仍写「（N-2 另按 `cells[]` 逐 suite fail 判定）」，而 §12.8-3/§11/§13.2 已是 N-1/N-2 同口径逐 suite 读法——一词对齐。
6. 干跑报告的 `## sample family` 尾行把 argv 误当 family 名（`--sample` 未传时打印 `/usr/local/bin/node`）——纯输出瑕疵，不影响计数与判据；实现 gates.mjs 时自检样本族查询建议走显式断言而非该便利开关。

### 18.7 结论与路由

- **verdict = reject**：仅 F-9（MAJOR，delta 引入）阻断。F-8 五款与 F-5r/T-1a 的规范文本、不得回退面全部核验通过；F-9 集中在取证脚本三处机械保真缺陷与自检表两行被自身证据反驳的表述，修订量小且可完全机械化验收。
- **路由**：SA1 修 `.cache/issue471-g10-dryrun/scan.mjs`（`inner[0]`、大小写、`*` 注释行）并重跑两 pass、按 §18.5(3)(4) 改 §9.2 两行自检 + 补 cast 回归断言；因对象仍是 §9.2 rev 2 的取证与自检面（SA8 §12.8-1 追认必查项），**requiresConflictRecheck = true**，回 SA8 增量追认后做 SA2 定向复审（仅 F-9 一点）。

---

## 19. 增量复审（iteration 3：620 行第三轮修订版 — F-9 定向复审，最后一道设计门禁）

### 19.0 Reviewed inputs 与方式

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-471_design.md`（620 行，iter-3 修订版；§9.2 rev 2.1 = F-9 取证对齐；`git rev-parse --short HEAD` = `d59a4d1` 复核） | 已全文实读重点章节（§9.2 全节/§4.1/§7.2–7.4/§8.1/§11/§12/§13.2/§17.3/§18） |
| 本评审 §18（F-9 及四点接受判据）与 SA8 `task_issue-471_design_conflict_report.md` §13（iteration 2 verdict=clear；I-1/I-2/I-3 实现义务） | 逐字对照 |
| `.cache/issue471-g10-dryrun/`：`scan.mjs`（229 行全读）、`cast-probe.mjs`（127 行全读）、`report-main.txt`/`report-n6.txt`/`report-cast-probe.txt`/`report-main-prefix.txt`/`report-n6-prefix.txt`、`n6-scratch/n6-g10-scratch.ts`、`scan-noface.mjs`（抽查） | **只读复跑三个 pass（主证、`--n6`、cast-probe），均与留档报告逐字节一致（diff 为空）** |
| 独立边界探针（`/tmp` 内联脚本，未在 `packages/`/`apps/` 建任何文件）：V_ctx 大小写成员表 15 token、`commentSpan` 字符串内 `*`/`*` 引导非注释行行为 | 本会话独立核验 |
| 工作树状态 | tracked 零改动；仅 `wiki/raw/task_issue-471_*.md` 六文件 untracked，`.cache` gitignored——扫描面不受污染 |

复审方式：只核验 dispatch 指定的 F-9 四点接受判据 + delta 风险 + 不得回退面；不重开已闭合章节。

### 19.1 Verdict（本轮）

**approve —— 可放行实现**（无 BLOCKER/MAJOR；余 2 项 MINOR 见 §19.6，均不阻断实现）。F-9 四点接受判据逐项核验通过（§19.2–§19.5），修订未引入新的 MAJOR 风险；不得回退面（F-8 五款、F-5r/T-1a、E-增补授权、十文件 ALLOW、B-1…B-5、T-2/T-3/T-4、N-6 三形态钉死集）全部维持。**requiresConflictRecheck = true 维持**：rev 2.1 把 I-1 对账基线数值由 iter-2 值（`cat_3=9 cat_5=2`）更新为 rev 2.1 值（`cat_3=7 cat_5=4`），属 SA8 §13.5 钉死值的取证面修订——设计已按其自身路由条款（§17.3 I-1 行/§18-4）声明「随本回 SA8 增量追认」，而冲突报告现止于 §13、该增量追认章尚未在案；这是路由义务而非设计缺陷（数值更新是已追认设计文语义的强制结果，非 gate 判定语义变化），须最迟于 G10 首落地对账前闭合。

### 19.2 判据 1：脚本修复是否真到位（只读复读 + 实跑）

| 修复点 | 核验证据 | 结论 |
|---|---|---|
| 两处 `inner[1]`→`inner[0]` | `scan.mjs:103`（`receiverOf`）与 `:205`（`receiverOfBracket`）——正则无捕获组，`inner[0]`=整匹配=**括内首个标识符**；内层非标识符起始（`(0 as any)`）⇒ `exec` 返回 `null` ⇒ 主循环 `recv===null` ⇒ **类 6 `(receiver=UNRESOLVED)`** fail-closed，不再落 5D | ✓ 到位 |
| `inVctx` 去 `/i` | `scan.mjs:38`：后缀交替恰 `ctx\|Ctx`、无 `/i` 标志。独立探针 15 token：`ctx`/`context`/`host`/`fiberCtx`/`timerCtx`/`myctx`/`A_ctx`/`Ctx` **入表**；`CTX`/`cTX`/`docContext`/`Context`/`fiberCTX`/`ctxs`/`rootctx2` **不入**——与设计文「大小写敏感、后缀恰 ctx/Ctx」逐项一致。BASE 零影响：修前修后 `5D-R=196`、`cat_6=0` 均不变 ⇒ 全树无任何大小写变体接收者实存（大小写收紧未搬动任何一条分类） | ✓ 到位 |
| `commentSpan` 补 `*`/`/*` 引导行 | `scan.mjs:74`：前导 `*` 或 `/*` ⇒ 全行纯注释。两实存迁移行源码复读确为 `*` 引导 JSDoc 行（`service.ts:41`、`plugin.ts:210`）且修后落类 5；探针 `/* probe ctx.root */` ⇒ 类 5。**未误伤字符串内的 `*`**：行中 `*`（`"a*ctx.root"`、`` `x*ctx.root` ``、`` `a*b` + ctx.root `` 三探针）`commentSpan` 均返回 -1 不触发 | ✓ 到位（`*` 引导非注释行为 latent 过排除面，见 §19.6-1） |

### 19.3 判据 2：计数不变性与变更解释

- **三 pass 只读复跑均与留档报告逐字节一致**（`report-main.txt`/`report-n6.txt`/`report-cast-probe.txt` diff 均为空；首行 HEAD `d59a4d1` 复现）。
- `report-main.txt` 计数行：`cat_1=19 cat_2=13 cat_3=7 cat_5=4 cat_5DR=196 cat_5DC=46 cat_6=0`（另 `cat_5DF=0`）；命中行实数 **285**（19+13+7+4+196+46+0 复算吻合，`grep -c` 命中行=285 互证）。cat_1 的 19 条构成逐条在案：两 seam（`service.ts:86`/`plugin.ts:251`，M4 `callee=safeReadChannel`）+ 通道探针文件级许可（`cordis-root-channel.test.ts` 11 条，含 `:458` `Reflect.get` 双读与 `:463/:468` `Context` 静态形）+ 3 fixture 双读行（`:19`/`:171`/`:39` 的 M1+M4 对）——与 §9.2 允许清单（T-2 钉死值）逐项吻合。
- **prefix→修后全量 diff 恰为声明 delta、无任何其他变化**（两对报告同构）：(i) **2 行记录级 token 修正（类不变，均 5D-R）**——`registry-create.test.ts:548` `receiver=undefined`→`input2`、`schema-write.ts:383` `receiver=undefined`→`snap`（SA8 I-1 预告「现两行 `receiver=undefined` → `snap`/`input2`，类不变」逐字兑现）；(ii) **2 行类移动 3→5**——`service.ts:41`/`plugin.ts:210`（`commentSpan` 补 `*` 引导行的规范文强制结果）；计数行 `cat_3` 9→7、`cat_5` 2→4 与节标题同步，即上述 4 行的聚合表达。逐行 diff 在案可复核。
- `cat_6=0` ✓；`--n6` `cat_6=3` 恰为三注入形态（`n6-g10-scratch.ts:4 [M1 receiver=ctx]`、`:5 [M3 source=ctx]`、`:6 [M1 receiver=ctx]`），其余计数与主证逐项相同、`scanned_files=733`、`cordis_faced=45` 不变（注入文件 8 行实读：零 Cordis 标记 + 一个 `ctx` 形参——与 §9.2 钉死样本逐字一致）。n6 vs main 全量 diff 仅首两行/`cat_6` 计数/三条类 6 记录。
- **iter-2 判据原文预期的修正与接受**：本评审 §18.5 所写「计数逐项相同（19/13/9/2/196/46/0）」所据的「`*`/`/*` 行 BASE 零实存」核验只覆盖了 V_ctx/cat-6 漏判面，未覆盖类 3↔5 之间的注释行移动——设计 §9.2 :348 对此的归因诚实且正确（本会话以逐行 diff 独立证实其完备性）。本判据按 dispatch 口径验收：**delta 恰为 2 行迁移 + 2 行 token 修正、总数 285/cat_6=0/n6=3 不变——通过**。

### 19.4 判据 3：自检表两行、钉死句与 cast 回归断言

| 核验点 | 设计位置（620 行版） | 与证据一致性 |
|---|---|---|
| `schema-write.ts:383` ⇒ 5D（`receiver=snap`） | §9.2 自检表 :327（附 iter-2 `undefined` 系脚本缺陷、已修的注记） | `report-main.txt:229` `[M2 (receiver=snap; unfaced)]` ✓ |
| `harness.ts:537` ⇒ 定义位部分结构性非候选（类 4 语义保留）+ 同行 `opts.root` ⇒ 5D（`receiver=opts`） | :329（rev 2.1 明确 iter-2「任何 matcher 均不触发」表述被干跑实录反驳、按修后机械语义改写） | `report-main.txt:252` `[M1 (receiver=opts; unfaced)]` ✓（源码 :537 复读确为定义位+同行读取复合行） |
| 新增锚点 `registry-create.test.ts:548` ⇒ 5D（`receiver=input2`） | :328（cast-M1 写目标形，M1 不分读/写如实记录） | `report-main.txt:211` ✓ |
| **cast 钉死句**（cast 括取内层首个标识符；不可解析（`(0 as any)`/括链 `a[i].root`）⇒ 候选 ⇒ 类 6 fail-closed，不得落 5D；gates.mjs 直接照抄——I-1① 机械承载） | §9.2 R1 :283 | `cast-probe.mjs` 实跑 **17/17 PASS**：`(ctx as any).root`/`(host as Context).root`/`(ctx as X)['root']`/`(ctx as Record<string,unknown>)['root']` ⇒ 类 6；`(0 as any).root`/`a[i].root` ⇒ 类 6（receiver=UNRESOLVED，fail-closed）✓；`ctx.root('hub',…)` ⇒ 类 2 ✓；`ctx.rootValue(x)` ⇒ 无 matcher ✓；`(snap as …)['root']` ⇒ 5D snap、`(input2 as …).root` ⇒ 5D input2、`harness.ts:537` 复合行 ⇒ 5D opts（三树锚点复算）✓ |
| **cast 回归断言入设计自检表** | :330–:331（两条合成探针行 ⇒ 类 6，标注「SA2 F-9 验收判据」「合成样本，非实存」——诚实标注）+ §13.2「含 cast 探针两行 ⇒ 类 6」 | ✓ |
| `cast-probe.mjs` 辅助函数「逐字复制自修后 `scan.mjs`」声明 | 设计 :345 | 五个函数体（`inVctx`/`commentSpan`/`insideString`/`receiverOf`/`receiverOfBracket`）机械 diff **逐字一致**（仅函数间空行分隔差异）✓ |
| 类 3 行自述（7 处，含 `service.ts:46`、`guard-proxy-consumption:105`；iter-2 计 9 系含两行 `*` 引导注释行） | §9.2 :294 | cat 3 七条逐一在案（`service.ts:46/:49`、`plugin.ts:217`、`guard-proxy:105`、`issue299:183`、`issue422:93`、`ws-plugin:34`）✓ |

### 19.5 判据 4：不得回退（逐面核验）

| 面 | 设计位置（iter-3 实读） | 结论 |
|---|---|---|
| F-8 五款 (a)–(e) | §9.2 :337–342（(a) 干跑留证 + (b) N-6 三形态 + (c) 两 seam + (d) 允许清单零增删/词表判别/≥4 域族 + (e) 全量输出） | 原样 ✓ |
| F-5r / T-1a 四款 | §7.2 E5 :165（`LIFECYCLE_UNITS` 23 名钉死枚举、`coverage` 定名、fail-closed、cell 谓词）、§8.1 :215、§13.2 :458、§4.1 :79 | 原样 ✓ |
| E-增补授权 | §7.2 E1 :160（suite 常量钉死）/E3 :162（`'gates'` 死字面量清理）/E4 :163（可选 diagnostics）/E4a :164（fault env 全分支贯通）、§7.3 G6 :176（挂基座）/G2-G3 :177（形状分明） | 原样 ✓ |
| 十文件闭合 ALLOW / 闭合世界 DENY | §12.1 :399–414 恰 10 文件、§12.2 :414/:418 | 原样 ✓（本轮零文件级增删，§17.3 末行自述与本会话 `git status` 互证） |
| B-1…B-5 | §4.1 :74–78 | 原样 ✓ |
| T-2/T-3/T-4 | §4.1 :80–82 + §7.3 G11 空集 :182/G12 :183 + §11 N-6 :391 | 原样 ✓ |
| **N-6 三形态钉死集** | §9.2 :304–315（钉死样本代码块零变化；iter-3 注显式「cast 括形不进 N-6 三形态钉死集……cast 形仅以合成探针进回归自检表与干跑 cast-probe.mjs 留证」）+ §11 :391 三形态原样 | **未被改动 ✓**；cast 形只进回归自检（§9.2 :330–331）与 cast-probe ✓——与 SA8 §12.8-1(b) 追认值一致，不构成本轮新增追认对象的自述成立 |
| I-1/I-2/I-3 吸收 | I-1① :283 钉死句、② :282 词表（原文已钉死）、③ :281 M4 跨行实参位、对账基线 :350；I-2 :274 联动条款 + §7.3 G12 :183（`changedPaths` = tracked ∪ untracked 显式口径——O-4 闭合）；I-3 :317 intro + 自检表逐行 token | 逐款落位 ✓ |
| SA2 §18.6 观察表态 | §17.3 末行：O-4/O-5 采纳闭合；O-1/O-2/O-3 边界声明（§9.2 :286）；O-6 维持（纯输出瑕疵，gates.mjs 自检走显式断言） | 表态完整 ✓（O-6 在修后报告尾行仍在——`## sample family: /usr/local/bin/node`，与「维持」表态一致） |
| 取证工件边界 | `scan-noface.mjs` 声明「辅助函数未随 rev 2.1 同步、不得用于判据」（设计 :351）经查**属实**（其 :98/:200 仍为 `inner[1]` 旧缺陷、头部已标注 do-not-use）——诚实声明 | ✓ |

### 19.6 Non-blocking observations（本轮；均不阻断实现）

1. **M1（`*` 引导非注释行的潜在过排除——取证脚本残余局限）**：`commentSpan` 把任何 `*` 起头行当纯注释，而设计类 5 文义是「`*`/`/*` 引导的**纯注释**行」——生成器速记行（`*gen() { … ctx.root … }`）与 `*` 起头的模板字面量续行会被脚本记类 5，按设计文应正常分类。BASE **零实存**（prefix↔修后 diff 恰 4 行已证）且 gates.mjs 按 I-1 以设计文本为准、不受脚本影响；建议在 §9.2 rev 2.1 残余局限注（现仅列 M4 跨行实参位一处）补一句同款声明，免 G10 首落地对账时重议。非阻断。
2. **M2（I-1 对账基线数值的 SA8 增量追认尚待在案）**：SA8 §13.8-2 I-1 字面仍钉 iter-2 值（`cat_3=9 cat_5=2`、「超出即回 SA8」）；rev 2.1 的 7/4 是已追认设计文语义的强制结果（「落地实现按设计文本语义本就直接得到 rev 2.1 值」，设计 :350），设计已透明路由（§17.3 I-1 行/§18-4、`requiresConflictRecheck=true` 维持），但冲突报告现止于 §13、无对应增量追认章。属路由义务而非设计缺陷：须最迟于 G10 首落地对账前由 SA8 增量追认闭合；本轮 verdict 不因此阻断。
3. O-6（`--sample` 尾行 argv 瑕疵）按设计表态维持现状——纯输出瑕疵、不承载判据（gates.mjs 自检样本族走显式断言、不采该便利开关），无新诉求。

### 19.7 结论与路由

- **verdict = approve（可放行实现）**：F-9 四点接受判据逐项通过；修订 = 取证脚本三处机械对齐 + 自检表两行改写 + cast 回归断言 + I-1/I-2/I-3 逐款吸收 + 对账基线更新，**不改变 gate 判定语义与任何已追认决策**；不得回退面全部维持。仅余 M1/M2 两项 MINOR（§19.6），不阻断 SA3 实现。
- **requiresConflictRecheck = true（维持，随本 verdict 提交）**：M2 的 SA8 增量追认（对账基线 9/2→7/4 + cast 钉死句/自检表增行的取证面追认）按设计 §18-4 路由执行；G10 首落地证据（BASE 首跑按 rev 2.1 基线逐项对账、N-6 三样本红、seam 自校验、I-3 逐行断言、I-2 联动条款专项核对）仍为 SA8 §13.11(ii) 必查项。
- 实现（SA3）落地 `gates.mjs` 时：以 §9.2 rev 2 设计文本语义为准（cast 括取括内首个标识符、不可解析 fail-closed ⇒ 类 6、V_ctx 大小写敏感、M4 跨行实参位），**不照抄干跑脚本**（I-1）；修后 `scan.mjs`/`cast-probe.mjs` 与两对留档报告是可逐字节复核的对账锚。
