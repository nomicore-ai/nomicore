# SA9 Standards Review — issue #412（codegen-freshness CI 修复轮：生成物重生成 + 字节哨兵重钉）

- 任务：issue #412（standards-review，**iteration 1**）
- 审查对象：**最终已提交 CI-repair diff**——commit `909476071610923c45e9f19b5229bdfcf395a3bc`（`fix(codegen): refresh generated vfs3 assets`），父提交 `75bd0ab feat(persistence): add completion drain lifecycle`（#412 主体实现），分支 `mabf/issue-412`
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER，author `welltop-jim-wang`）——本轮经 `gh api` 独立拉取核对元数据与全文：①graceful-shutdown 的 **drain-before-dispose 硬契约**（「宿主优雅停机必须先 `await drain()` 再 dispose」写为硬性契约而非参考建议）；②**同步修订 ADR-0006 :86** dispose 定义（否则契约与实现继续脱节）；③dispose 保持 abortive 时保留**分层公开 drain**
- 审查纪律：静态标准审查（不运行测试、不启动服务、不修改代码/设计/测试、不调度其他 SA；所有事实以只读方式独立核对——sha256 复算、git 字节谱系、源码/CI/AGENTS 通读、`gh api` 只读拉取）；范围 = 仓库/工程标准符合性，不审查 Issue 需求是否完整实现（SA10 面）
- 历史轮次：iteration 0 SA9 审查对象 = #412 主体实现（当时未提交 diff / commit `1fef434`），verdict **approve**（0 BLOCKER/0 MAJOR/6 MINOR）。该结论由本文件前身承载，其被审内容经本轮核对**逐字节保持**（见 §5-B），原结论不变；本文件按原位更新惯例只裁决本轮 dispatch 对象（CI-repair diff），前身全文留存于 git 历史（`75bd0ab:wiki/raw/task_issue-412_sa9_standards.md`）

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| CI-repair diff（`git diff 75bd0ab..9094760`，6 文件：3 代码 + 3 wiki 过程产物） | 全量逐行核对 | 被审对象 |
| Owner comment `5751613018` | `gh api` 独立拉取（id/updated_at/association/body 一致） | 保持性基准 |
| `.github/workflows/ci.yml`（`codegen-freshness` job :124-147） | 已读 | 修复目标门：唯一步骤 `pnpm generate --check`（ADR 0005 §4 AC4 执行器） |
| `domains/AGENTS.md` §Workflow/§Boundaries、`packages/vfsl/AGENTS.md`、`packages/vfsl-codegen/AGENTS.md`、root/`docs/AGENTS.md` | 已读 | 生成物刷新规定动作与验证门 |
| `packages/vfsl-codegen/src/header.ts`、`package.json` | 已读 | 横幅版本自同步机制（ADR 0005 §4 生成器漂移警报载体） |
| 两哨兵测试全文（`number-literals-fixture-drift.test.ts`、`int-range-fixture-drift.test.ts`） | 已读 | 重钉面与语义锚核对 |
| `packages/vfsl-codegen/test/generate-union-member-docs.test.ts:523-542` | 已读 | 仓内新鲜度负控（全字节比对 + spawn `--check`）的敏感性 |
| ADR 0005 §4、ADR 0020 决策 5/7、ADR 0006 :242-282（#412 修订节） | 已读 | 规范依据与 #412 硬契约成文面 |
| Git 考古（generated.ts/schema.vfsl/package.json 历史、`1fef434`↔`75bd0ab` 树比对、`2fdac1b..HEAD` 生成器/vfsl src 变更枚举） | 只读核对 | 根因归属、重生成确定性、提交谱系 |
| `sha256sum` 独立复算（HEAD 与 HEAD~1 的 generated.ts） | 已执行（只读） | 钉值逐字节核验 |
| `wiki/raw/task_issue-412_sa3_impl.md` / `..._sa4_review.md` / `..._implementation_conflict_report.md`（本轮同 commit 更新） | 已读 | SA3/SA4/SA8 申报与裁决的交叉核对（不独立复跑其动态验证） |
| #412 硬契约锚点（ADR 0006 修订节、app.ts 停机链、lifecycle.ts drain、contract.ts 分层成员、SA6 契约文件） | HEAD 现读抽验 | Owner 要求保持性确认 |

## 2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；3 × MINOR 观察全部非阻断，见 §9）。

核心判定：修复动作是 ADR 0005 §4 与 `domains/AGENTS.md` §Workflow 的**规定动作**（重生成刷新，非手改生成文本、非削弱门禁）；字节谱系三重独立核验闭合（旧钉值＝HEAD~1 文件 sha256、新钉值＝HEAD 文件 sha256＝两哨兵同值重钉、横幅＝生成器现行版本自同步输出）；两处哨兵重钉走其自述的绊线工作流且语义锚零漂移；issue #412 行为（drain-before-dispose 硬契约 + ADR-0006 对齐 + 分层 drain + retryDelayMs 解耦）在本 diff 中**零触碰、全锚点在位**。

## 3. 修复面的标准符合性

| 标准 | 核对结果 |
| --- | --- |
| ADR 0005 §4（生成物入仓 + CI regen-diff 双抓） | ✅ 修复 = 全量重生成使 regen-diff 复空；根因 = 发布提交 `abbb89a` 将 `packages/vfsl-codegen` 0.1.3→0.2.0 时未同步重生成（`git show abbb89a --stat -- domains/` 为空；generated.ts 末次重生成 = `2fdac1b`）——仓库级历史遗留，非 #412 引入（`75bd0ab` 零触碰 `domains/**`、`packages/vfsl*/**`，stat 核对） |
| `domains/AGENTS.md` §Workflow 2/3（`pnpm generate` 刷新；改生成器而非手改生成物） | ✅ 生成物 diff 恰 1 行（`1 insertion(+), 1 deletion(-)`）= 生成器身份横幅；该行是 `header.ts:41` 的版本自同步输出（运行时读本包 `package.json` → `0.2.0`），与生成器确定性输出按构造一致；被否备选（改 `header.ts` 钉死/移除版本横幅）会削弱 ADR 0005 §4 生成器漂移警报且越权触碰 `packages/vfsl-codegen/**`——否决正确，生成器源码零触碰 |
| `header.ts` 设计意图（doc-comment :4-8） | ✅ 「版本 bump 后头注自动随之变化，regen-diff 自动报警」——本轮即报警的规定应答；`Source hash: sha256:82e98fa1…b93c69` 未变（schema.vfsl 自 `526ee4f` 零改动），头注四行结构完整 |
| `packages/vfsl-codegen/AGENTS.md`（确定性/字节稳定；`--check` 检出义务） | ✅ 生成器包零触碰；修复前的红 = 检出义务正常工作，修复后 = 新鲜态终态 |
| `packages/vfsl/AGENTS.md`（fingerprint inputs 为兼容行为） | ✅ vfsl 包源码零触碰；envelope/semantic 指纹钉值（`sha256:v1:7b6c19…`/`sha256:v1:b71b…`）与 `sha256:v1:` 前缀断言在两哨兵中**零改动** |
| 哨兵契约（#314/#315 SA6 绿→保持绿；doc-comment 自述「重新生成即此处先红」） | ✅ 重钉 = 各 1 行值 + 2 行重钉原因注释（内联三重语义中性证据：横幅唯一差异/双指纹未变/Source hash 未变）；全部断言、断言纪律（不 skip/不软化）、语义锚零改动；旧钉值是 #314/#315 **变更集范围**验收基线（wiki/raw 证据层，docs/AGENTS Authority），非常设冻结决策——重钉不构成 override；新钉值经本审查独立 `sha256sum` 复算与现文件逐字节一致，哨兵对后续任何 `domains/vfs3-assets/**` 改写继续 fail loud |
| 重钉完备性 | ✅ `GENERATED_SHA256` 全仓仅出现于该两文件（grep 核实），同值同步；旧值 `342d8c1f…e6707` 仅残存于 #314/#315/#316 冻结历史 wiki 记录（过程证据只读，不改写正确）；无第三个字节哨兵遗漏 |
| 隐藏漂移排除（静态） | ✅ schema 零 `Int`/`Range` 记号（ADR 0020 对本域惰性）；union 成员无逐成员 doc（ADR 0019 条件稀疏表整键缺席）；`0860870` 对 codegen src 的唯一改动 = `protocol-surface.ts` 碰撞守卫名单（+4/−1，fail-loud 断言输入，非发射逻辑）；`2fdac1b..HEAD` 其余 vfsl src 变更的语义锚由未改动的指纹钉值兜底 |
| 门禁敏感性（不充分修复不可静默通过） | ✅ 仓内负控 `:529`（regen 输出 vs 盘上**全字节**比对）+ `:538`（spawn `pnpm generate --check` 期待 exit 0）+ CI `codegen-freshness` 同锚——「只改横幅而投影体有漂移」的伪修复必然转红；`FileSchemaSource.list()` 恰 `[vfs3-assets@1]` ⟹ 无第二陈旧域 |

## 4. 文件范围（ALLOW/DENY）

`git diff 75bd0ab..9094760 --name-only` 恰 6 文件：

- **代码 3**：`domains/vfs3-assets/generated.ts`（横幅 1 行）、`packages/vfsl/test/{number-literals,int-range}-fixture-drift.test.ts`（各 1 行值 + 2 行注释）。三者**不在** #412 设计 §11 ALLOW/DENY 两表内（该设计未预见仓库级 codegen 漂移）——扩权依据 = 本轮 dispatch 明示修复指令 + `domains/AGENTS.md` §Workflow 规定动作；SA3 已透明申报，SA8 R12 裁决无决策抵触（范围认定属 Controller 职权）。**DENY 逐项零触碰**（git 名单核实）：persistence `service.ts`/`testing.ts`、namespace-registry、dsh 四件、persistence 既有测试与冻结审计、**SA6 两契约文件**、apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、`packages/vfsl-codegen/**`、`.github/**`、`schema.vfsl`。
- **wiki 过程产物 3**：SA3/SA4/SA8 报告原位更新（`wiki/raw/` 既有 `task_*_sa*.md` 先例；内容经 §6 交叉核对，申报一致、无瞒报）。
- `git diff --check` 干净；commit message 符合仓内 conventional-commit 惯例。

## 5. issue #412 行为保持确认（Owner comment 5751613018）

**A. 本 diff 与 #412 全部契约面零交集**：`packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/**`、`CONTEXT.md`、`docs/integration/**`、`packages/dsh-persistence/**`、`packages/namespace-registry/**`、`docs/protocols/**`、`packages/ws-replication/**` 在 repair commit 名单外（逐路径核对为空）。codegen 修复与持久层生命周期正交。

**B. 主体实现逐字节保持**：`git diff 1fef434 75bd0ab`（iteration 0 SA9 批准提交 ↔ 当前特性提交）= 仅新增 2 份 wiki 报告（SA9/SA10），代码树**逐字节相同**——历史改写（rebase）未改变任何被批准内容；`75bd0ab` 27 文件 stat 与 SA3 申报一致。

**C. 硬契约锚点 HEAD 抽验全部在位**：

| Owner 要求 | HEAD 证据 | 判定 |
| --- | --- | --- |
| drain-before-dispose **硬契约**（非建议） | ADR 0006 修订节第 3 条（:270-274）：无条件条款 + 「预算尽后继续 dispose 是显式可观察退出，不是违约」+ 未 drain 直接 dispose 的代价申明；app.ts:624 `await this.awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于 :630 `persistenceFiber.dispose()`（两出口 = 完成或 :625 预算事件已发射）；file/memory 统一无 kind 特判 | **保持** |
| **ADR-0006 :86 对齐** | 修订节第 4 条（:276）「本节**修订并扩展** :86 的 dispose 定义边界」：dispose 保持 abortive/有损（§228-5 重申）、从来不是持久性屏障、持久性唯一经分层公开 drain 表达、「dispose 内部先 drain」否决论证在文 | **保持** |
| dispose 保持 abortive + **分层公开 drain** | contract.ts:176 `readonly drain?:` optional 分层成员；lifecycle.ts:858 `async drain`；SA6 契约三文件（drain-red 27 / drain-surface 5 / semantics 9）+ shutdown 3 tests 全部在提交体内零触碰 | **保持** |
| retryDelayMs 解耦（缺省保持现行为） | ADR 第 5 条解析形状红线与实现载体零触碰 | **保持** |

## 6. wiki 产物一致性交叉核对

- SA8 实现后复审（iteration 1，R1–R13：**no-conflict 12 / implements 1 / hard-conflict 0**，requiresConflictRecheck false）——其 R1 确定性闭环、R6 哨兵裁决、R11 #412 零破坏与本审查独立核对逐项一致（含 sha256 谱系、`abbb89a` 根因、`2fdac1b` 末次重生成）。
- SA4 Part A **approve**（0 finding）；其 §A8 掩蔽排除三链（schema 零 Int/Range、无成员 doc、`0860870` 仅碰撞守卫名单）经本审查静态复核属实。
- SA3 申报（修复后 `pnpm generate --check` exit 0、root test 5242 全绿、root typecheck exit 0）本角色不复跑；但门禁链对不充分修复**结构性敏感**（§3 末行），且字节级事实（新旧钉值、横幅值、单 hunk diff）均经独立复算佐证，申报与静态证据自洽。
- SA4 R-2 归因说明显示 iteration 0「2 个既有失败」（负控 :529/:538）与重生成后「2 处哨兵红」为同一漂移的两阶段机械构成——无矛盾。

## 7. 仓库 AGENTS / 惯例总核对（本轮触面）

| 条款 | 结果 |
| --- | --- |
| root AGENTS：改 `domains/`、`packages/` 前读最近嵌套 AGENTS | 过程产物证实各 SA 已读；本审查逐条对照 |
| docs AGENTS：wiki/raw = 证据层非规范；规范演进走 ADR/CONTEXT | 本修复零规范文本变化，无需演进；ADR 0005 §4 义务为执行而非修订 |
| 单一事实源 | 生成器版本唯一源 = `packages/vfsl-codegen/package.json`（未引入手工常量/同步脚本等第二事实源）；生成物字节唯一写者 = `pnpm generate`；字节钉值唯一载体 = 两哨兵（同值同步，非第三处复制） |
| 生命周期/流程对称性 | 发布 bump（因）→ 重生成（果）在本轮补齐；门禁红→修复→绿的应答链完整，未留下被削弱的报警面 |
| 历史产物只读纪律 | #314/#315/#316 冻结记录未改写；iteration 0 SA9 结论经 §5-B 树比对确认其对象保持，无需翻案 |

## 8. 测试质量标准（本轮触面）

| 维度 | 核对结果 |
| --- | --- |
| runner 真实发现 | 两哨兵在 `vitest.config.ts` include `packages/*/test/**/*.test.ts` 覆盖内；iteration 0 曾实测触发（修复前红），发现性已证 |
| skip/only/todo | 两文件全文通读**零** skip/only/todo；diff 未引入任何软化 |
| 断言面 | 重钉未触碰任何断言——字节钉（sha256 of 生成物）、双指纹逐字节钉、前缀断言、`list()` 断言全部原样；新钉值 = 真实字节（独立复算）⟹ 非「改测试迎合实现」，而是「哨兵随审定的语义中性重生成换钉」 |
| 重钉注释纪律 | 2 行内联注释记录缘由与语义中性证据（优于仅改值的裸重钉），后续同类重钉可沿用 |

## 9. Findings（全部 MINOR，非阻断）

| # | 严重度 | Finding | 证据 | 建议处置 |
| --- | --- | --- | --- | --- |
| N-1 | MINOR（流程） | 根因是发布提交 `abbb89a` bump `@nomicore/vfsl-codegen` 版本未同变更集重生成——把仓库留在「`--check` 恒红」态直至本轮；属发布流程缺口而非本 diff 缺陷 | `git show abbb89a -- packages/vfsl-codegen/package.json`（+0.2.0，`domains/` 零触碰）；SA8 §8 行动 1 同款记录 | 后续凡 bump 该包版本的发布变更集同集执行 `pnpm generate`（ADR 0005 §4 原子性精神）；纯流程提醒，无文本需修订 |
| N-2 | MINOR（留档说明） | #314/#315/#316 冻结 wiki 记录仍以旧值 `342d8c1f…` 描述当时钉值——现为历史值 | grep 8 处命中全在冻结过程产物 | 不处置（上游产物只读；本行即差异缘由留档，SA4 R-1 同款） |
| N-3 | MINOR（验证分工固有） | SA9 静态审查不运行门禁：`pnpm generate --check` exit 0 与 root 全绿为 SA3 申报；本审查以字节谱系独立复算 + 门禁链敏感性分析佐证，动态终判属 CI/SA7 面 | §1 纪律行；§3 末行 | 无需处置；若 CI `codegen-freshness` 仍红则回流 SA3（意味着 §3 排除链有漏，概率极低） |

## 10. 结论

- CI-repair diff（`9094760`）在仓库/工程标准全部维度符合：修复通道 = ADR 0005 §4 与 `domains/AGENTS.md` 的规定动作；最小性（生成物 1 行 + 哨兵各 3 行）与正确性（三重字节复算闭合）成立；单一事实源与门禁报警能力未削弱；DENY 面与生成器源码零触碰；wiki 过程产物申报透明且交叉一致。
- **issue #412 行为确认保持**：Owner comment `5751613018`（updated 2026-09-20T18:03:36Z，`gh api` 独立核对）要求的 drain-before-dispose 硬契约与 ADR-0006 对齐，其成文载体（ADR 0006 修订节 :242-282）、实现载体（app.ts 统一有界排空链 :614-630、lifecycle.ts:858、contract.ts:176）与验收载体（SA6 契约 + 语义/停机测试）在本 diff 中零触碰、HEAD 抽验全部在位；主体实现与 iteration 0 批准内容逐字节一致。
- 3 项 MINOR 均为非阻断的流程/留档/分工说明。
- **Verdict: approve**。
