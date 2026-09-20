# SA8 实现后冲突复审 — issue #412（codegen-freshness CI 修复轮；implementation）

- 复审对象：**implementation**——工作区当前未提交的 **CI-repair 变更集**（3 个代码文件 + 1 个 SA3 报告更新，`git status`/`git diff` 全量核对），对照 ADR 全集、CONTEXT.md、规范指南/协议文档、模块 AGENTS、CI 门禁定义与已批准设计（design iteration 2）
- 仓库 / worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD = `75bd0ab feat(persistence): add completion drain lifecycle`，#412 主体实现已提交且逐字节保持）
- SA8 dispatch：`sa-f5e09dd6-d636-452c-bbd2-0d7378b73672`（phase: conflict-gate，iteration 1）；dispatch 问题域 = 「CI-repair changes for codegen-freshness against repository generation contracts and normative constraints」+ 确认与 issue #412 硬契约（Owner comment 5751613018）零冲突
- **原位更新说明**：本文件前一身（iteration 0，dispatch `sa-939d6e66…`）复审的 #412 主体实现变更集（13 修改 + 2 新增测试）已由 Controller 提交为 `75bd0ab`，该轮 verdict **clear**、requiresConflictRecheck **false**，结论已闭合不在此堆叠；本报告只裁决**当前被审对象** = 本轮 codegen-freshness 修复增量 diff

---

## 1. Reviewed subject

**implementation**——修复 CI `codegen-freshness` job 失败的最小变更集（当前未提交 diff，恰 4 文件）：

1. `domains/vfs3-assets/generated.ts`：经 `pnpm generate` 全量重生成刷新生成器身份横幅 `@nomicore/vfsl-codegen@0.1.3 → 0.2.0`——**唯一一行 diff**；`Source hash: sha256:82e98fa1…b93c69` 与头注以下全部投影类型字节不变（`git diff` 1 insertion/1 deletion 核对）；
2. `packages/vfsl/test/number-literals-fixture-drift.test.ts`（issue #314 哨兵）：`GENERATED_SHA256` 重钉 `342d8c1f…e6707 → a934f62d…d65b` + 2 行重钉原因注释；`ENVELOPE_FINGERPRINT`/`SEMANTIC_FINGERPRINT` 常量与全部断言零改动；
3. `packages/vfsl/test/int-range-fixture-drift.test.ts`（issue #315 哨兵）：同值重钉 + 2 行注释；语义指纹常量、新 fixture 断言零改动；
4. `wiki/raw/task_issue-412_sa3_impl.md`：SA3 自身产物本轮更新（诊断/根因/修复/验证记录）——wiki/raw 为证据层（docs/AGENTS.md Authority），非决策面。

SA8 职责边界：只裁决与既有决策集的冲突、演进义务与冻结面保持；不判断测试充分性/实现质量（SA4/SA7 面）；不运行测试或生成器——所有事实以只读方式独立核对（sha256 谱系、git 历史、字节 diff、源码阅读）。

## 2. Inputs and decision set

| 输入 | 状态 | 说明 |
| --- | --- | --- |
| 当前 diff（被审对象） | 已全量读取 | `git diff HEAD`（4 文件）+ 两哨兵测试全文阅读 + `git status --porcelain`（恰 4 修改、零未跟踪、零越界） |
| `wiki/raw/task_issue-412_design.md`（iteration 2） | 已读（§11 文件范围两表） | 本轮 3 个代码文件**不在** ALLOW/DENY 两表内（设计未预见仓库级 codegen 漂移）；DENY 逐项对照零触碰 |
| `wiki/raw/task_issue-412_sa3_impl.md`（本轮更新版） | 已读 | 诊断（根因 = 发布提交 `abbb89a` 版本 bump 未重生成）、修复动作、范围申报与验证记录；其声明经本报告独立复核 |
| `wiki/raw/task_issue-314_sa6_contract.md`、`task_issue-315_sa6_contract.md` | 已读（§4 基线/§12.6 C5/§15 触发矩阵） | 两哨兵的契约来源：`generated.ts` sha256 钉值 `342d8c1f…e6707` 为 **#314/#315 变更集范围的验收基线**（`9742a28` 闭合）；C5 触发矩阵明示「重新生成 generated.ts → 此处先红」为设计的绊线行为 |
| ADR 0005 §4（生成物入仓 + CI regen-diff） | 已读（全文） | 本修复的规范依据：`generate --check` 全量重生成 → diff 为空；源漂移与生成器漂移双抓 |
| ADR 0020 决策 5/7 | 已读 | 既有 fixture 语义指纹逐字节不变；Int/Range codegen「生成物形状不胀、`generate --check` 字节稳定性基线不变」 |
| ADR 0017 | 已读（相关节） | 指纹域（envelope/semantic、`sha256:v1:` 不透明字符串）——本轮零触碰 |
| ADR 0006（含 issue #412 修订节） | 已读（:242-282 现状） | #412 硬契约面在 HEAD 的成文状态（Owner comment 5751613018 要求的落点），本轮 diff 零触碰 |
| ADR 全集（0001–0030） | 状态核对 | 全部 accepted、无 superseded（0008/0010 为 0017 增补式修订）；无 ADR 钉死 `generated.ts` 字节或生成器横幅版本 |
| CONTEXT.md / `docs/vfsl/schema-authoring-guide.md` | 已读（相关节） | 指南 :286-304 生成工作流（regenerate → 审 diff → `--check` 逐字节比较；「不直接维护生成文件」）；CONTEXT 无被抵触词条 |
| 模块 AGENTS（domains / packages/vfsl / packages/vfsl-codegen / docs） | 已读 | 决策集合组成部分：生成物刷新规定动作、生成器确定性/`--check` 检出义务、指纹输入为兼容行为 |
| `.github/workflows/ci.yml`（codegen-freshness job） | 已读 | job 唯一步骤 = `pnpm generate --check`；注释明示 AC4（ADR 0005 §4）；工作流文件零触碰 |
| **Issue #412 + Owner comment 5751613018** | 已独立拉取（`gh api`；id/时间戳/作者核对一致：created=updated=2026-09-20T18:03:36Z，welltop-jim-wang） | 硬契约要求三件套：①「宿主优雅停机必须先 await drain() 再 dispose」为硬性契约；②同步修订 ADR-0006 :86 dispose 定义；③dispose 保持 abortive 时保留分层公开 drain——全部由 `75bd0ab` 落地，本轮只需确认未被修复轮破坏 |
| 源码/历史事实 | 只读核对 | `header.ts` 版本自同步设计；`packages/vfsl-codegen/package.json` 版本谱系（2fdac1b=0.1.3 → abbb89a=0.2.0）；sha256 谱系（现文件=`a934f62d…d65b`＝新钉值；HEAD 文件=`342d8c1f…e6707`＝旧钉值）；`75bd0ab`/`abbb89a` 对 `domains/**`、`packages/vfsl*` 的触碰统计 |

## 3. Decision analysis

| # | Decision | Clause | Subject behavior（实际 diff） | Classification | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | **ADR 0005 §4（生成管线保鲜）** | 「CI `generate --check`：全量重新生成 → diff 为空；**源漂移与生成器逻辑漂移双抓**……schema 改动与重新生成同一原子提交」 | 修复兑现被违反的保鲜义务：发布提交 `abbb89a` 把 `packages/vfsl-codegen/package.json` 0.1.3→0.2.0 但未重生成（`generated.ts` 最后重生成于 `2fdac1b`，时点版本 0.1.3——banner/Source hash 与该版生成器输出一致），此后仓库在**任何**提交上 `--check` 恒红；本轮全量重生成使 regen-diff 复空。确定性闭环独立验证：现文件与最后一次生成器产物（`2fdac1b`）逐字节差异**恰为版本派生的 Generator 横幅一行**，新值 `@0.2.0` 与现行包版本一致，schema 未动 ⟹ 现文件 = (schema, 0.2.0) 的确定性输出，`--check` 按构造通过（SA8 未运行生成器，以字节谱系+确定性条款推导） | **implements-existing-decision**（兑现既有决策明确要求、因历史发布提交未履行而落空的义务） | ADR 0005:49-55；`git show abbb89a -- packages/vfsl-codegen/package.json`（+0.2.0，domains/ 零触碰）；`git log -- generated.ts`（2fdac1b）；`git show 2fdac1b:…package.json`（0.1.3）；`git diff`（唯一 1 行）；header.ts:4-8 | 无（义务已恢复） |
| R2 | ADR 0005 §4（头注契约） | 「生成文件入仓（纯类型文本……），头注 `GENERATED … DO NOT EDIT` + 源文本哈希」 | 头注四行结构完整保持；`Source hash: sha256:82e98fa1…b93c69` 未变（schema.vfsl 自 `526ee4f` 零改动，其文本哈希自然不变）；横幅如实反映生成器身份 0.2.0 | no-conflict | `git diff HEAD -- domains/vfs3-assets/generated.ts`（1 行）；`git log -- schema.vfsl` | 无 |
| R3 | ADR 0005 §4「生成器漂移双抓」+ `header.ts` 设计意图 | 「Generator 行版本 = 运行时自同步……版本 bump 后头注自动随之变化，regen-diff 自动报警，消除『手工同步常量』的漏报失败模式」 | 报警能力完整保留：本轮以重生成应答报警（规定动作），而非削弱报警——被否备选（改 `header.ts` 钉死/移除版本横幅）会恰好灭掉 ADR 0005 §4 的生成器漂移警报并越权触碰 `packages/vfsl-codegen/**`，未采纳是正确的；生成器源码零触碰 | no-conflict | header.ts:4-8（doc-comment 明文）；`git status`（packages/vfsl-codegen/** 零改动） | 无 |
| R4 | `domains/AGENTS.md` §Workflow/§Boundaries | 「Run root `pnpm generate` to refresh generated projections」「change generator code rather than hand-editing generated output」「Treat generated files as artifacts…must not fork their projected types」 | 按规定命令刷新生成物，未手改生成文本（字节变化为生成器发射：与 `2fdac1b` 生成器产物仅横幅一行之差，该行由包版本派生）；头注以下投影类型逐字节未分叉 | no-conflict | domains/AGENTS.md:10-18；`git diff`；R1 确定性闭环 | 无 |
| R5 | ADR 0020 决策 5/7 | 「无 Int/Range 的 schema，IR 紧凑 JSON 逐字节不变」「生成物形状不胀、`generate --check` 字节稳定性基线不变」 | 其治理的语义层全部保持：envelope/semantic 指纹钉值不变（`sha256:v1:7b6c19…`/`sha256:v1:b71b…`，两哨兵常量零改动且仍被断言）；投影类型零变化。唯一字节差异是生成器身份横幅——在 ADR 0020（Int/Range 码生成不得改变既有输出）范围之外，其随包版本变化是 ADR 0005/header.ts 的**设计机制**，非 0020 基线所指的语义漂移 | no-conflict | ADR 0020:125-151；两哨兵文件 diff（指纹常量与断言零改动） | 无 |
| R6 | issue #314/#315 SA6 绿→保持绿契约（字节哨兵） | 哨兵 doc-comment：「任何 IR 键序变化、指纹前缀升版（v2）、`domains/vfs3-assets/**` 改写都会在这里先红」；测试名自述「重新生成即此处先红」；#314/#315 SA6 §4/§12.6 将 `342d8c1f…e6707` 钉为**该两变更集的** HEAD 验收基线（C5 触发矩阵：重新生成 → C5 先红） | 重钉走的是哨兵自述的设计路径：有意的语义中性重生成使字节钉**先红**（绊线按设计工作），人工/代理确认后重钉 `GENERATED_SHA256` = 现文件实测 sha256（`a934f62d…d65b`，本报告独立复算一致）；语义锚（双指纹常量）与全部断言、断言纪律（不 skip/不软化）零改动——哨兵对未来任何 `domains/vfs3-assets/**` 改写继续 fail loud。裁决依据：SA6 §4 的逐字节钉值是 #314/#315 **变更集范围**的验收基线（已于 `9742a28` 闭合），不是常设冻结决策；wiki/raw 为证据非规范（docs/AGENTS.md Authority），已提交测试是绊线不是冻结面 | no-conflict | 两哨兵全文（:25-30 重钉+注释、指纹断言 :41-45/:60-63 不变）；`sha256sum` 现文件/HEAD 文件复核；task_issue-314_sa6_contract.md §4/§15、task_issue-315_sa6_contract.md §4/§12.6 | 无 |
| R7 | `packages/vfsl-codegen/AGENTS.md` | 「Keep output deterministic and byte-stable. `pnpm generate --check` must detect every stale generated file without rewriting accepted source state」 | 生成器包零触碰；确定性保持（同 (输入, 包版本) → 逐字节同输出，header.ts:4 条款）；修复前的红 = 检出义务正常工作，修复后 = 新鲜态——恰是该条款要求的终态 | no-conflict | git status；header.ts:4；AGENTS 全文 | 无 |
| R8 | `packages/vfsl/AGENTS.md` | 「Stable error codes, issue ordering, path reporting, envelope strictness, and **fingerprint inputs** are compatibility behavior」 | vfsl 包源码零触碰（仅两测试文件的 fixture 常量重钉——测试钉值不是 fingerprint inputs）；双指纹逐字节不变、`sha256:v1:` 前缀未升版 | no-conflict | git status；哨兵指纹断言 | 无 |
| R9 | `docs/vfsl/schema-authoring-guide.md`（生成工作流） | 「1. `pnpm generate`……3. `pnpm generate --check`：重新生成到内存并逐字节比较」「`generated.ts` 是生成物……不直接维护生成文件」 | 修复严格循此工作流：重生成 → 审 diff（唯一横幅行）→ 新鲜度恢复；未直接维护生成文件 | no-conflict | 指南 :286-304 | 无 |
| R10 | CI `codegen-freshness` job（ADR 0005 §4 AC4 执行器） | job 唯一步骤 = `pnpm generate --check`（.github/workflows/ci.yml，注释「源漂移与生成器漂移双抓……必须全量重生成再 diff」） | 修复恰指向该 job 的失败步骤，工作流定义零改动；失败根因（`abbb89a` 遗留）先于 #412 变更集存在——`75bd0ab` 对 `domains/**`、`packages/vfsl*` 零触碰（`git show --stat` 核对），非 #412 引入 | no-conflict | ci.yml（codegen-freshness job）；`git show 75bd0ab --stat`、`git show abbb89a --stat` | 无 |
| R11 | **Owner comment 5751613018（要求权威）+ ADR 0006 修订节（#412 硬契约面）** | ①「宿主优雅停机必须先 await drain() 再 dispose」为**硬性契约**（非参考建议）；②同步修订 ADR-0006 :86 dispose 定义（「修订并扩展」，分层保持：公开 `drain()` + dispose 保持 abortive）；③retryDelayMs 解耦缺省保持现行为 | **零交集、零破坏**：本轮 diff 对全部 #412 契约面逐字节未触——`git diff HEAD` 作用于 `packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/0006-*.md`、`CONTEXT.md`、`docs/integration/**`、`packages/dsh-persistence/**`、`packages/namespace-registry/**`、`docs/protocols/**`、`packages/ws-replication/**` 的输出为**空**；`75bd0ab` 提交态完整保持（ADR 0006 修订节 :242-282 现存于 HEAD，含硬契约条款/:86 修订扩展/分层 drain/retryDelayMs 解析形状；app.ts 统一排空链与两份 SA6 契约文件均在提交内未动）。codegen 修复与持久层生命周期正交 | no-conflict | `git diff HEAD --stat`（上述路径全空）；ADR 0006:242-282（HEAD 现读）；`gh api` owner 评论原文 | 无 |
| R12 | #412 设计 §11 ALLOW/DENY（文件范围纪律） | ALLOW/DENY 两表（DENY 含：persistence service/testing、namespace-registry、dsh 四件、persistence 既有测试、**SA6 两契约文件**、apps 既有测试、docs/protocols、ws-replication、Host/SA6/SA2/SA8 wiki 产物） | 本轮 3 个代码文件不在两表任何一列（设计未预见仓库级 codegen 漂移——SA3 已如实申报）；**DENY 逐项零触碰**（git status 核对）；越界权属 = 本轮 dispatch 明示修复指令（「以最小安全改动修复失败的 codegen-freshness CI 检查」）+ `domains/AGENTS.md` §Workflow 规定动作。范围授权认定属 Controller 职权，非 SA8 冲突事项——无任何决策文本被抵触 | no-conflict（范围申报事项，交 Controller 认定） | 设计 §11 两表；`git status --porcelain`（恰 4 文件） | 无（范围认定交 Controller；SA3 申报已透明） |
| R13 | 根 AGENTS.md（Typed Namespace writes / schema 授权纪律） | 「When creating or editing `domains/*/schema.vfsl`, follow `docs/vfsl/schema-authoring-guide.md`」；typed-writes 三件套义务 | `schema.vfsl` 零触碰（最后改动 `526ee4f`）；无 schema/投影类型/变异路径变化——typed-access 义务面未被触及 | no-conflict | `git log -- schema.vfsl`；`git diff`（仅生成物横幅） | 无 |

裁决分布：**no-conflict 12（R2–R13）/ implements-existing-decision 1（R1）/ evolution-required 0 / hard-conflict 0**（共 13 行对照）。

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
| --- | --- | --- | --- |

**无。** 本修复未主张、也未需要任何 override：

- 旧字节钉值 `342d8c1f…e6707` **不是决策文本**（#314/#315 SA6 契约为 wiki/raw 证据层 + 变更集范围验收基线；已提交哨兵是绊线非冻结面）；其更新是哨兵自述设计路径（「重新生成即此处先红」→ 确认 → 重钉）的执行，不是对任何 ADR/协议/Owner 决策的推翻。
- 生成器横幅 0.1.3→0.2.0 是 `header.ts` 版本自同步机制的**设计内行为**（ADR 0005 §4 生成器漂移警报的载体），非契约变更。
- 无 ADR supersede、无协议版本升级、无 Owner override 需求或主张；被否备选（削弱横幅/改生成器）若被采纳反而构成对 ADR 0005 §4 警报能力的削弱——未发生。

## 5. Frozen surfaces

| Surface | Must remain unchanged | Evidence | Actual result（实际 diff 核对） |
| --- | --- | --- | --- |
| `domains/vfs3-assets/schema.vfsl`（schema 唯一真相源） | 逐字节不变 | `git log`（最后改动 526ee4f）；`git diff`（未列） | **保持** |
| 生成物头注 `Source hash` | `sha256:82e98fa1…b93c69`（= 未动 schema 文本的哈希） | diff 上下文行 | **保持** |
| 生成物投影类型（头注以下全部字节） | 与 `2fdac1b` 生成器产物逐字节一致 | `git diff`（1 file / 1 insertion / 1 deletion，唯一行 = Generator 横幅） | **保持** |
| 哨兵语义锚：`ENVELOPE_FINGERPRINT`/`SEMANTIC_FINGERPRINT`（`sha256:v1:7b6c19…`/`sha256:v1:b71b…`）+ 两文件全部断言与断言纪律 | 逐字节保持、不 skip/不软化 | 两哨兵 diff（仅 GENERATED_SHA256 值 + 2 行注释） | **保持**（新钉值经独立 sha256 复算与现文件一致） |
| 指纹前缀 `sha256:v1:`（ADR 0017/0020 域） | 未升版 | 哨兵常量与前缀断言零改动 | **保持** |
| `packages/vfsl-codegen/**`（生成器源码；包版本 0.2.0 系 `abbb89a` 既有事实，非本轮改动） | 零触碰 | `git status` | **保持** |
| CI 工作流定义（codegen-freshness 及全部 job） | 零触碰 | `git status` | **保持** |
| **#412 硬契约面**：app.ts 统一有界排空停机链、ADR 0006 修订节（硬契约/:86 修订扩展/分层 drain/retryDelayMs 形状）、CONTEXT.md「完成式排空」词条、两份集成文档、SA6 两契约测试文件、persistence/yjs-server 全部源与既有测试 | 与 `75bd0ab` 提交态逐字节一致（Owner comment 5751613018 三要求的成文与实现载体） | `git diff HEAD`（上述全部路径输出为空）；ADR 0006:242-282 HEAD 现读 | **保持** |

## 6. Evolution requirements

**无。** 本修复不改任何决策文本、协议、公共 API、schema、持久化格式、状态机或失败语义——不存在需要修订计划的事项。

- ADR 0005 §4「schema 改动与重新生成同一原子提交」：本轮**无 schema 改动**；生成器身份刷新跟随 `header.ts` 自同步机制。理想形态是版本 bump 的发布变更集自带重生成（原子性精神），`abbb89a` 未做到而留下设计内的红色报警态，本轮修复即该报警的规定清除动作——**不产生决策文本缺口**，仅记流程观察（见 §8 行动 1）。

## 7. Hard conflicts

**无。** 特别核对：

- **重钉 vs 哨兵契约**：绊线语义完整保留（语义指纹常量 + 全部断言 + fail-loud 行为），重钉是哨兵测试名自述的预期路径（「重新生成即此处先红」）；不重钉则 `codegen-freshness`（ADR 0005 §4）与字节钉**在同一提交上逻辑不可兼得**——该不可兼得态由 `abbb89a` 遗留造成，本轮以规定动作（重生成）+ 设计路径（重钉）同时恢复两者，消解的是**既有不一致**而非制造新冲突；
- **#412 硬契约零破坏**：修复与持久层生命周期/停机链/ADR 0006/集成文档零交集（§5 末行），Owner 三要求（硬契约成文、:86 修订对齐、分层 drain 保留）的载体全部保持 `75bd0ab` 提交态；
- **最小性**：备选路径（改 `header.ts` 钉死版本/移除横幅、或回滚重生成）分别会削弱 ADR 0005 §4 警报能力或使 CI 永久红——均被正确否决；未触碰生成器源码、schema、#412 SA6 契约与全部 DENY 面。

## 8. Required actions

1. **（非阻断，流程观察）** 后续凡 bump `@nomicore/vfsl-codegen` 版本的发布变更集，应同变更集执行 `pnpm generate`（ADR 0005 §4 原子性精神 + `header.ts` 自同步设计），避免重造仓库级红色报警态——纯流程提醒，无决策文本需要修订。
2. **（非阻断，交 Controller 认定）** 本轮 3 个代码文件不在 #412 设计 §11 ALLOW/DENY 两表内；扩权依据 = 本轮 dispatch 明示修复指令 + `domains/AGENTS.md` §Workflow 规定动作，SA3 已透明申报。SA8 裁决无决策抵触；范围认定属 Controller 职权。
3. **（交 SA4/SA7 裁断面）** SA3 申报的动态验证结果（`pnpm generate --check` exit 0、root typecheck/test 全绿等）由 SA4/SA7 复核，不属冲突门禁事项；本报告以只读字节谱系独立确认了其可推证基础（确定性闭环，见 R1）。
4. 冲突门禁侧无阻断行动：本变更集可在通过动态质量门后随 #412 一并提交。

## 9. Verdict

**clear**

- 13 项对照：12 no-conflict + 1 implements-existing-decision（ADR 0005 §4 保鲜义务恢复）+ 0 evolution-required + 0 hard-conflict；
- 修复走的是仓库既有决策自铺的路径：`domains/AGENTS.md` §Workflow 规定动作 + `header.ts` 版本自同步设计内行为 + 哨兵「先红→确认→重钉」设计路径，三者的规范依据互相咬合，无一处需要新决策或 override；
- **dispatch 两问均获肯定答案**：①CI-repair 变更与仓库生成契约（ADR 0005 §4 / ADR 0020 决策 5/7 / ADR 0017 指纹域 / 模块 AGENTS / 授权指南 / CI 门禁）及规范约束零冲突，且恢复了被 `abbb89a` 遗留违反的保鲜义务；②与 issue #412 硬 graceful-shutdown drain-before-dispose 契约及 Owner comment 5751613018 要求的 ADR 对齐**零冲突零触碰**——`75bd0ab` 提交态（硬契约成文、:86 修订并扩展、分层 drain、file/memory 统一停机链）逐字节保持。

## 10. requiresConflictRecheck

**false**

- 本修复未开任何新决策面：无公共 API/wire/schema/持久化格式/状态机/生命周期/失败语义变化，无正式 override；
- 全部核对均针对当前实际 diff 完成（字节谱系、指纹常量、冻结面、#412 契约面完整性），无「尚待实现核对」的遗留项；
- 前一 iteration（#412 主体实现）的复审已闭合（clear / requiresConflictRecheck false），其对象已提交为 `75bd0ab` 且本轮确认未被触碰——无需重开。
