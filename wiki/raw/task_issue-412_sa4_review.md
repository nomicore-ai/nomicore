# SA4 Implementation Review — issue #412

- 任务：issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）
- Worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`，HEAD `75bd0ab`）
- 本轮 dispatch：`sa-0adb9d00-81a7-41f5-9e06-96af112a5bb8`（phase **implementation-review**，iteration 1）
- 本轮审查对象：**codegen-freshness CI 修复轮**——`75bd0ab` 之上的未提交增量（`git status` 恰 4 文件：生成物 1 + 字节哨兵 2 + SA3 报告），确认「生成物与 fixture 哨兵更新最小、正确、不改变 #412 语义」
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`——**硬性优雅停机 drain-before-dispose 契约与 ADR 对齐必须保持**（本轮以「保持性」维度复核，见 §3）
- 审查纪律：静态实现审查。未运行测试/未启动服务/未修改实现；本轮新证据 = 只读 Git 考古 + `sha256sum` 独立复算 + 源码/测试/CI/AGENTS 通读。历史轮次的 `gh api` 只读拉取结论沿用（§Part B-3）
- 历史轮次：**Part B**（iteration 0）= #412 主体实现审查（已提交为 `75bd0ab`，27 文件核对无漂移，结论 **approve** 保持，关键锚本轮抽验仍在）

---

# Part A — codegen-freshness CI 修复轮（iteration 1，本轮 dispatch 对象）

## A1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| 本轮 dispatch 指令（修复失败的 `codegen-freshness` 检查，最小安全改动，保持 #412 语义） | 已读 | 审查授权范围 + 验收面 |
| Owner comment `5751613018`（updated `2026-09-20T18:03:36Z`） | dispatch 传入 + Part B §3 `gh api` 全文核对沿用 | drain-before-dispose 硬契约 + ADR 对齐的保持性基准 |
| 当前 diff：`domains/vfs3-assets/generated.ts`、`packages/vfsl/test/{int-range,number-literals}-fixture-drift.test.ts`、`wiki/raw/task_issue-412_sa3_impl.md` | 逐行核对（`git diff` 全量） | 最小性/正确性 |
| `wiki/raw/task_issue-412_sa3_impl.md`（本轮更新版） | 已读 | 诊断根因、修复裁决、验证申报的交叉核对 |
| `.github/workflows/ci.yml:128-147`（`codegen-freshness` job） | 已读 | CI 触发面：唯一步骤 `pnpm generate --check`（:147） |
| `domains/AGENTS.md` §Workflow 1-4 | 已读 | 生成物刷新规定动作（2/3：重生成而非手改） |
| `packages/vfsl-codegen/src/header.ts`、`emitter.ts`、`protocol-surface.ts`、`packages/vfsl-codegen/package.json` | 已读 | 横幅版本自同步机制 + 发射器输入面 |
| `packages/vfsl-codegen/test/generate-union-member-docs.test.ts:523-544` | 已读 | 仓内新鲜度负控（字节比对 + spawn `--check`） |
| Git 考古：`git log -- domains/vfs3-assets/{generated.ts,schema.vfsl}`、`git show abbb89a -- packages/vfsl-codegen/package.json`、`git show --stat abbb89a -- domains/`、`git log 2fdac1b..HEAD -- packages/vfsl-codegen/src` | 只读核对 | 根因归属 + 重生成输出确定性 |
| `sha256sum` 独立复算（worktree/HEAD/schema.vfsl） | 已执行（只读） | 钉值逐字节核验 |
| HEAD `75bd0ab` 提交内容抽验（`packages/persistence/src/lifecycle.ts`、`apps/yjs-server/src/app.ts`、`docs/adr/0006-server-persistence-docstore.md`） | grep 定位核对 | #412 硬契约保持性 |
| `wiki/raw/task_issue-412_implementation_conflict_report.md`（SA8 实现后复审） | 已读（头部） | 冲突门闭合状态 |

## A2. Verdict

**approve**（0 × BLOCKER；0 × MAJOR；本轮新增 0 × MINOR 阻断项，观察项见 §A12）。

核心判定：

1. **最小**：生成物改动 = 头注横幅**恰 1 行**（`@nomicore/vfsl-codegen@0.1.3 → 0.2.0`）；两哨兵各 = `GENERATED_SHA256` 1 行 + 重钉原因注释 2 行，断言与语义指纹常量零改动；`git status` 全工作区恰 4 文件。
2. **正确**：新钉值 `a934f62d…d65b` = 本审查独立 `sha256sum` 复算值（逐字节一致）；横幅版本 = 当前 `packages/vfsl-codegen/package.json` `0.2.0`；`Source hash` 未变且 = `sha256sum schema.vfsl`（schema 自 `2fdac1b` 零改动）⟹ 除横幅外生成物 = 既有已验证字节，语义零漂移。
3. **不改变 #412 语义**：本轮 4 文件与 #412 设计 §11 全部 15 行 ALLOW 路径**零交集**；`75bd0ab` 提交体内的 drain-before-dispose 硬契约（lifecycle.ts:858 `drain()`、app.ts:559/624 `awaitDrainWithBudget`、:625 预算尽诚实事件、ADR 0006 :242/:270 无条件硬契约条款）逐项抽验在位、逐字节未被触碰。
4. **根因归属成立**：漂移源自发布提交 `abbb89a`（版本 0.1.3→0.2.0，`git show --stat … -- domains/` 为空 = 未同步重生成），生成物自 `2fdac1b` 起未再重生成——仓库级历史遗留，非 #412 变更集引入（`75bd0ab` 零触碰 `domains/**`、`packages/vfsl*/**`）。

## A3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 本轮 dispatch：「review the CI-repair implementation…confirm the generated output and fixture sentinel updates are minimal, correct, and do not alter issue #412 semantics」 | 见 §A4/§A5/§A6/§A8：最小性（1+1+1 行级改动）、正确性（钉值/横幅/Source hash 三重复算）、语义保持（零交集 + 提交体抽验） | **落实** |
| 本轮 dispatch：「repair the failed codegen-freshness CI check…smallest safe change」（SA3 侧执行指令） | 修复 = 规定动作 `pnpm generate`（`domains/AGENTS.md` §Workflow 2/3）而非手改生成文本/削弱门禁；备选（改 `header.ts` 钉死/去版本横幅）被正确否决——会削弱 ADR 0005 §4 生成器漂移警报且触碰 `packages/vfsl-codegen/**`，非最小 | **落实**（工程裁决正确） |
| Owner comment `5751613018`（2026-09-20T18:03:36Z）：dispose 前 await drain 的**硬契约**保持 | 工作区 diff 零触碰 `packages/persistence/**`、`apps/yjs-server/**`；提交体锚在位：`lifecycle.ts:858 async drain`、`app.ts:624 await this.awaitDrainWithBudget(adapter.drain(), budgetMs)`（唯一 `persistenceFiber.dispose()` 之前）、`:625 persistence-drain-budget-exceeded` | **保持**（本轮改动在物理上不可能影响该契约——不同文件） |
| Owner comment `5751613018`：ADR 对齐（ADR 0006 修订节）保持 | 工作区 diff 零触碰 `docs/adr/**`；`docs/adr/0006-server-persistence-docstore.md:242` 修订节 + `:270` 无条件硬契约条款（明文引用 comment 5751613018）在提交体中原样在位 | **保持** |
| Owner comment `5751613018`：dispose 保持 abortive、分层公开 drain | `75bd0ab` 提交体未变（本轮零触碰）；Part B §3 逐条核对结论沿用 | **保持** |

## A4. 设计落实审查（修复裁决 vs 规范动作）

| Design decision / 规范 | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| ADR 0005 §4 / CI 注释（ci.yml:124-127）：新鲜度 = 全量重生成 → 与仓内生成物**逐字节 diff**（双抓源漂移与生成器漂移） | 修复采用「重生成刷新横幅」——正是该机制设计上要求的动作：横幅版本 = 生成时运行时读 `package.json`（header.ts:5-8 doc-comment 明示「版本 bump 后头注自动随之变化，regen-diff 自动报警」） | 忠实——版本 bump 后横幅必须随 regen 更新，保持旧横幅的任何方案都是对门禁的削弱 | — |
| `domains/AGENTS.md` §Workflow 2/3：「Run root `pnpm generate` to refresh generated projections」「change generator code rather than hand-editing generated output」 | 生成物差异恰 = 横幅一行；投影类型体/TSDoc/`declare module` 增广逐字节未变（`git diff` 1 insertion/1 deletion + 双向 sha256 复算） | 忠实。注：静态无法区分「真跑 regen」与「手改同一行」，但两者**字节结果等价**且等价性有三重独立锚（见 §A8），新鲜度闭环由 CI 步骤本身终判 | — |
| 根因诊断：漂移始于 `abbb89a` 而非 #412 变更集 | `git show abbb89a -- packages/vfsl-codegen/package.json` = `0.1.3→0.2.0`；`git show --stat abbb89a -- domains/` = **空**；`git log --oneline -- domains/vfs3-assets/generated.ts` 末次 = `2fdac1b` | 属实。#412 提交 `75bd0ab` 与 `domains/**`、`packages/vfsl*/**` 零交集 | — |
| 哨兵重钉裁决：重钉而非回滚重生成 | 回滚 ⟹ `codegen-freshness` 永久红（版本不可能回退）；两哨兵 doc-comment 自述「重新生成即此处先红」（number-literals:48 / int-range:66）= 设计上预期 regen 先红、人工确认语义中性后重钉——#314/#315 既定工作流 | 裁决正确，且为使 root `pnpm test` 与 CI 同时转绿的**唯一**语义中性路径 | — |

## A5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 生成器身份横幅 | 生成器（header.ts 运行时读 package.json，单一事实源） | 未引入 `GENERATOR_VERSION` 手工常量（header.ts:7-8 明示消除该漏报失败模式） | 正确——无第二版本事实源 |
| 生成物字节 | `pnpm generate`（唯一写者） | 修复走 regen 通道；无手改投影文本 | 正确 |
| 字节钉值哨兵 | 各任务域测试（#314/#315） | 仅重钉 `GENERATED_SHA256` + 注释；指纹常量与断言不动 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 版本 bump 后生成物刷新 | `domains/AGENTS.md` §Workflow 规定动作；历史上 `8d6edf1`（six packages bump）等发布提交均伴随重生成 | 本轮同款（regen + 哨兵随动） | 一致 | 复用规定通道，无旁路 |
| 新鲜度门禁 | CI `codegen-freshness`（ci.yml:128-147）+ 仓内负控 `generate-union-member-docs.test.ts:529/:538` | 修复目标是这两道门的同一事实（盘上字节 == regen 输出） | 一致 | 双门同锚，修复不选择性满足其一 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| 生成器版本 | `packages/vfsl-codegen/package.json` | 生成物横幅（生成时快照） | 低——regen-diff 门禁使横幅滞后即红（这正是本次抓到的漂移） |
| 生成物字节 | `pnpm generate` 输出 | 两哨兵 `GENERATED_SHA256` 钉值 | 低——钉值随审定的语义中性 regen 重钉，fail-loud 对后续改写保持 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 绕开 regen 的「横幅同步」脚本/常量 | 无 | 未引入（备选被否决） | 无平行 |
| 第二套新鲜度判定（纯哈希比对） | 无（CI 注释明言纯哈希抓不到生成器漂移） | 未引入 | 无平行 |

## A6. 文件范围审查

`git status --porcelain` 恰 4 条（无 untracked 实现文件）：

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `domains/vfs3-assets/generated.ts` | 不在 #412 设计 §11 ALLOW/DENY 两表内——**本轮 dispatch 明示扩权**（repair codegen-freshness）+ `domains/AGENTS.md` §Workflow 2/3 规定动作 | 刷新生成器身份横幅 1 行 | **贴合扩权范围**。非 DENY；`schema.vfsl`、`packages/vfsl-codegen/**` 零触碰 |
| `packages/vfsl/test/int-range-fixture-drift.test.ts` | 同上（dispatch 扩权的必然后果：哨兵钉死旧字节，不重钉则 `pnpm test` 必红、CI 不绿） | `GENERATED_SHA256` 重钉 + 2 行注释 | 贴合（issue #315 哨兵；断言/语义指纹零改动） |
| `packages/vfsl/test/number-literals-fixture-drift.test.ts` | 同上 | 同上（issue #314 哨兵） | 贴合 |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 自有过程产物（非实现） | 本轮修复报告 | 不属实现范围 |

DENY 零触碰复核：设计 §11 DENY 全表（service.ts/testing.ts/namespace-registry/dsh 四文件/persistence 冻结审计/**SA6 两契约文件**/yjs-server 既有测试/docs:protocols/ws-replication/上游 wiki）+ `packages/vfsl-codegen/**` —— `git status` 全部干净。范围申报与 SA3 报告「本轮范围申报」节一致，无瞒报。

## A7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| 生成物字节变化（横幅行） | ① `domains/vfs3-assets/index.ts`（`export * from './generated.js'`）+ 域内 3 测试（2 `.test-d.ts` 类型面 + tsdoc 挂载面） | 投影类型/TSDoc 体逐字节未变 ⟹ 类型面与 tsdoc 断言零影响（SA3 申报 3 files/31 tests 绿） | 无 | — |
| | ② 两字节哨兵（#314/#315） | 恰为本轮重钉对象——唯一的受影响 caller，已同步 | 无 | — |
| | ③ 新鲜度负控 `generate-union-member-docs.test.ts:529`（regen 输出 vs 盘上逐字节比对，含横幅）/`:538`（spawn `pnpm generate --check` 期待 exit 0） | 修复前两者红（横幅 0.1.3 vs 包 0.2.0——即 iteration 0 报告的「2 个既有失败」的机械构成）；修复后转绿的充要条件 = 盘上文件 **全字节** 等于 regen 输出 | 无——该负控使「只改横幅但投影体漂移」的伪造修复必然在此红 | — |
| | ④ CI `codegen-freshness`（:147 `pnpm generate --check`） | 同③ | 无 | — |
| 哨兵重钉 | 后续任何 `domains/vfs3-assets/**` 改写 | 哨兵继续 fail-loud（钉值 = 新字节，任何再改写即红）；内联注释记录重钉缘由与语义中性证据 | 无 | — |
| #412 契约面（drain API/事件/ADR 条款/SA6 契约文件） | 全部 caller | 本轮零触碰（不同文件） | 无 | — |

## A8. 错误、恢复与并发

- **确定性/幂等**：`header.ts:4`「同（输入, 包版本）→ 逐字节同输出」；`schema.vfsl` 未变 + 包版本未再变 ⟹ 重复 regen 收敛到当前盘上字节，`--check` 稳定 exit 0（非偶然通过）。
- **掩蔽风险（本轮重点攻击面）——结论：无掩蔽**。重钉可能掩盖「生成物真实语义漂移」的路径全部排除：
  1. `schema.vfsl` 工作区零改动（git status）且 `sha256sum schema.vfsl` = `82e98fa…b93c69` = 生成物头注 `Source hash` ⟹ 无源漂移；
  2. 生成物除横幅行外与 HEAD 逐字节相同（`git diff` 单 hunk；HEAD sha256 = 旧钉值 `342d8c1f…e6707`，worktree sha256 = 新钉值 `a934f62d…d65b`，均独立复算）⟹ 投影体零漂移；
  3. 生成器源码自末次 regen（`2fdac1b`）起的三次变更均不改本域输出：`b158f98`（ADR 0019 成员 doc——本域无成员 doc 派生物，负控 :529 的前提）、`9742a28`（ADR 0020 Int/Range——`schema.vfsl` 零 Int/Range 记号，grep 0 命中）、`0860870`（ADR 0024——仅 `protocol-surface.ts` 碰撞守卫名单 +`DeepOptional`，该名单仅作 fail-loud 断言输入（emitter.ts:143-145），本域别名 `AssetId/Audit/AssetEntity/Attachments/ROOT` 与 13 名协议导出零碰撞 ⟹ 发射字节不变；#314/#315/#316 冻结门禁历史记录亦证 ADR 0020 集成后字节仍为 `342d8c1f…`）。
- **失败模式**：若上述任一排除不成立（即 regen 输出不止横幅一行），CI :147 与负控 :529 必红——修复不可静默半成立。静态无法运行的动态终判列入 §A11。
- **域全集**：`FileSchemaSource.list()` 恰为 `[vfs3-assets@1]`（哨兵断言）⟹ 不存在第二个陈旧域生成物使 `--check`（全量）失败。

## A9. 测试质量审查（本轮触面）

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `packages/vfsl/test/number-literals-fixture-drift.test.ts`（#314 哨兵，3 tests） | ① `list()` == `[vfs3-assets@1]`；② envelope/semantic 指纹逐字节 == 基线 + `sha256:v1:` 前缀；③ `generated.ts` sha256 == 钉值 | root `pnpm test` 分片（`packages/*/test/**/*.test.ts`；iteration 0 曾实测触发，发现性已证） | **零弱化**：改动仅钉值 1 行 + 注释 2 行；②的指纹源自 `schema.vfsl`（未触碰）经 `compileSchemaEnvelope`，与横幅正交——保持不变是正确而非遗漏；无 skip/only/todo（全文通读） | — |
| `packages/vfsl/test/int-range-fixture-drift.test.ts`（#315 哨兵，5 tests） | 同上 ③ + 新 fixture 编译/指纹稳定/IR JSON 往返 | 同上 | 同上（同款重钉，断言面零改动） | — |
| `packages/vfsl-codegen/test/generate-union-member-docs.test.ts` 负控（:529/:538，**零触碰**） | regen 输出 vs 盘上全字节相等；spawn `pnpm generate --check` exit 0 | root `pnpm test` 分片 + CI typecheck 作业 | 无——本修复的行内验收器；对「横幅外漂移」敏感（全字节比对） | — |
| CI `codegen-freshness`（ci.yml:128-147） | `pnpm generate --check` exit 0（全量重生成 diff 为空；零域集 exit 2 响亮失败） | push/PR CI | 无——本轮修复的直接目标门禁 | — |
| SA6 两契约文件（#412） | 27 运行期 + 5 类型 | root `pnpm test`/typecheck | 零触碰（git status 干净）——红灯契约保持 | — |

**SA6 红灯保持（跨轮）**：#412 两契约文件与冻结审计零触碰。**哨兵敏感性**：重钉后钉值 = 当前真实字节，任何后续改写（含手改横幅以外的任何行）即红——敏感性经构造保持。

## A10. Required revisions（本轮）

无 BLOCKER / MAJOR / MINOR finding。

## A11. 后续动态验证项（本轮新增）

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| `pnpm generate --check` 在 CI 环境实际 exit 0（本审查静态推断修复充分，未运行） | CI push 后 `codegen-freshness` job | job 绿 | 仍红 ⟹ regen 输出存在横幅外差异（§A8 排除链有漏），回流 SA3 |
| root `pnpm test` 全绿申报（5242 tests，含两重钉哨兵与 :529/:538 负控）复现 | 后续验证角色 | 全绿 exit 0 | 两哨兵或负控任一红 |
| （承接 Part B §11 各项——慢盘预算充分性、nomic-server 采纳、S-5a 墙钟余量、claim 环交错） | 见 Part B | — | — |

## A12. Non-blocking observations（本轮新增）

| # | 严重度 | 观察 | 建议处置 |
| --- | --- | --- | --- |
| R-1 | 观察 | 已关闭任务 #314/#315/#316 的冻结 wiki 记录（如 `task_issue-316_sa6_contract.md` C2b）仍以 `342d8c1f…` 描述当时钉值——现为历史值。属冻结过程产物，非活门禁，无漂移风险 | 不处置（上游产物只读；本行留档说明差异缘由） |
| R-2 | 观察 | iteration 0 报告把「2 个既有失败」归因于 `generate-union-member-docs` 新鲜度断言，本轮报告归因于两字节哨兵——两说不矛盾（修复前红 = :529/:538 两测；重生成后红 = 两哨兵），机械构成已在本审查复核闭合 | 无需处置；本轮报告已含完整诊断 |
| R-3 | 观察 | 两哨兵重钉注释中「生成物 Source hash 未变」等三重语义中性证据内联在测试处——优于仅改钉值无说明的惯例 | 保持（后续同类重钉建议沿用此注释纪律） |

## A13. 复查标记（本轮）

本轮未发现新的 ADR 冲突维度：横幅刷新是 ADR 0005 §4 门禁的**规定动作**而非对齐例外；哨兵重钉遵循 #314/#315 既有工作流。`requiresConflictRecheck` 本轮提交 **false**（Part B 轮次的实现后冲突复查已由 SA8 产物 `task_issue-412_implementation_conflict_report.md` 承担）。

---

# Part B — #412 主体实现审查（iteration 0；已提交为 `75bd0ab`，结论保持）

> 本轮复核：`git show --stat 75bd0ab`（27 文件）与设计 ALLOW 对齐；提交后 `packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/0006/**`、`CONTEXT.md`、`docs/integration/**`、SA6 两契约文件均零后续触碰（`git status` 仅 Part A 的 4 文件）；关键锚 grep 在位（`lifecycle.ts:858 drain`、四移除点 `releaseSettleWaiters` :679/:709/:831/:1195、`app.ts:559/624/625`、ADR 0006 :242/:270）。iteration 0 审查结论 **approve** 无需修订，原文保持如下。

- 审查对象（当时）：SA3 实际实现 + 测试（13 文件修改 + 2 新增测试文件；diff 全量核对）
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER）——`gh api` 独立拉取全文核对
- 审查纪律：静态实现审查（未运行测试/未启动服务/未修改实现；`npx vitest list` 仅做 runner 发现枚举，不执行用例）

## B1. Reviewed inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-412.md` | 已读 | Issue 正文（缺口 1/2、请求面、消费方证据） |
| Issue #412 正文 + comment 5751613018（`gh` 只读拉取） | 已读 | Owner 硬契约 + ADR-0006 对齐 + 分层 drain + 第三击穿窗口 + 问题 2 解耦确认；评论 updated_at 与 dispatch 一致（2026-09-20T18:03:36Z，MEMBER），无更新版本 |
| `wiki/raw/task_issue-412_design.md`（iteration 2，558 行） | 已读 | 批准设计：DD-1~DD-8、§8 状态机、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-412_sa2_review.md` | 已读（§2 verdict approve / §13 修订映射） | SA2-1~SA2-13 落实核对基准 |
| `wiki/raw/task_issue-412_sa6_contract.md` | 已读（§5/§8/§13/§15） | 契约项 C1–C14、红灯归因、D-5 语义缺口（S-1~S-4）、冻结审计裁决 |
| `wiki/raw/task_issue-412_design_conflict_report.md` | 已读（O1–O3 + D1–D19 + 行动 1–7） | SA8 约束：同变更集、缺省不物化、注释诚实性、liveness 不变量 |
| `wiki/raw/task_issue-412_sa3_impl.md` | 已读 | 实现报告（changed paths / 验证命令 / deviations） |
| 源码 diff：`packages/persistence/src/{contract,lifecycle,memory,file,index}.ts`、`packages/dsh-persistence/src/probe.ts`、`apps/yjs-server/src/{app,config,main}.ts`、四份文档 | 逐行核对 | 实现保真 |
| 测试：SA6 两契约文件 + 新增 `persistence-issue-412-drain-semantics.test.ts`（9 tests）+ `persistence-drain-shutdown.test.ts`（3 tests）+ 既有锚 | 逐行核对 | 测试质量与触发面 |
| `vitest.config.ts`、`.github/workflows/ci.yml`、`packages/persistence/AGENTS.md`、`apps/yjs-server/AGENTS.md` | 已读 | runner/CI 触发与模块验证门 |

## B2. Verdict（iteration 0）

**approve**（0 × BLOCKER；0 × MAJOR；4 × MINOR 全部非阻断，见 §B10/§B12）。

核心判定：实现与 iteration 2 批准设计**逐条忠实**；Owner 三项硬要求（硬契约成文且 app 结构性强制、ADR-0006 :86 修订对齐、分层公开 drain 且 dispose 保持 abortive）全部落地并有行为级测试锚定；SA2-1/SA2-7 两个 MAJOR 修订的验收行（S-5a/S-5b/S-5c）真实存在、断言敏感、被真实 runner 触发；文件范围严格贴合 ALLOW 15 行，DENY 零触碰。

## B3. 上游要求落实

Owner 评论按 Comment ID + updated_at 核对（5751613018，2026-09-20T18:03:36Z，MEMBER——`gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` 全文拉取；该 issue 仅有此一条评论，无更新版本覆盖）。

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 「把『宿主优雅停机必须先 await drain() 再 dispose』写为**硬性契约**而非参考建议」 | ① ADR 0006 修订节第 3 条（docs/adr/0006-server-persistence-docstore.md:270 起）：无条件条款 + 「预算尽后继续 dispose 是显式可观察退出，不是违约」+ 「未经 drain 直接 dispose 的宿主接受静默丢失」代价申明；② app.ts:604-627：`performStop` 第 3 步在**唯一**的 `persistenceFiber.dispose()`（:630）之前 `await this.awaitDrainWithBudget(adapter.drain(), budgetMs)`，预算尽先发 `persistence-drain-budget-exceeded` 再继续——结构性强制（全仓唯一 dispose 调用点在 drain 之后；main.ts 停机/换装全部经 `app.stop()`）；③ cordis-plugin-hosting.md:64/:455-478 对仓库外宿主的同款硬契约指引 + 示例代码块 | **落实**。条款、对外指引、自家实现三方同答案；S-5c 以原型 spy 锚定 drain 恰一次且严格先于 `persistence-disposed` |
| 「同步修订 ADR-0006 :86 对 dispose 的现有定义——否则契约与实现继续脱节」 | ADR 修订节第 4 条：「本节**修订并扩展** :86 的 dispose 定义边界」（:86 原文经 `sed -n '80,92p'` 核实）——dispose 保持 abortive/有损、从来不是持久性屏障、「dispose 前的持久性」唯一经分层 drain 表达；约束性修订语气（SA8 O2 要求） | **落实**（SA2-10 措辞采纳） |
| 「可以接受分层方案（公开 drain()，dispose 保持 abortive），但至少需要硬契约 + ADR 对齐」 | `DocPersistence.drain?` optional 分层成员（contract.ts:149-176）；dispose 路径零改动（仅把内联 waiter 通知抽为 `releaseSettleWaiters`，行为逐字节等价）；DD-7 备选 (iii) 否决论证入 ADR 第 4 条 | **落实**（分层保持） |
| 第三个击穿窗口：degraded entry 的 retry 回退窗（backoff 上限 maxDirtyMs） | drain 对 `retryTimer` 武装只注册 waiter 被动等待（lifecycle.ts:866-869），零热循环（1f：attempts 恒 1 锚定）；宿主预算覆盖回退窗（S-5b：预算 520ms 内收口 + 事件） | **落实** |
| 问题 2 解耦属实、独立 `retryDelayMs` 配置（缺省保持现行为） | `PersistenceSchedule.retryDelayMs?`（contract.ts:513-523）+ `resolvePersistenceSchedule` 条件展开（:548-552，校验环自动覆盖新键 → 非法值 RangeError）+ `retryBaseMs` getter 单源（lifecycle.ts:1077-1082）改引 createEntry（:1094）与 flush 成功回落（:1152）两落点；DSH 探针镜像锁步（probe.ts:444-447） | **落实**。缺省 `(undefined ?? debounceMs) \|\| 1` ≡ 旧 `debounceMs \|\| 1`（静态等价）；缺省不物化键（SA8 action 2 红线遵守，冻结审计零迁移） |
| Issue 正文请求面（drain 语义 6 条 + 可选 targets + 宿主替换固定睡眠） | 见 §B4 | **落实** |

SA6 契约承接：C1–C14 全部由 SA6 两份契约文件（27 运行期 + 5 类型）锚定，实现后转绿；S-1~S-4/S-5a/S-5b/S-5c 补充锚全部新增。

## B4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| DD-1 drain 放置面：`DocPersistence.drain?` optional + 两 adapter 具体类方法 + barrel 导出 + 不进 `ReplicaPersistence` | contract.ts:68-73/:149-176；memory.ts:189-194；file.ts:149-159；index.ts:37；ReplicaPersistence 零改动 | 忠实。File 入口 targets 逐个 `validateIdentity`（`targets === undefined` 无校验路径），错误文案与 assertSafePathSegment 一致（file.ts:257-262） | — |
| DD-2 retryDelayMs 键形状不变（缺省回退在 lifecycle 内） | contract.ts:545-552 条件展开；lifecycle.ts:1077-1082 getter | 忠实。`persistence-contract.test.ts:32-37` 两键 `toEqual` 零改动即绿；probe 默认时间线逐字节不变 | — |
| DD-3 optional 类型建模 | contract.ts:513 | 忠实；`TEST_SCHEDULE` 两键字面量零迁移 | — |
| DD-4 目标集合形状 `targets?: readonly PersistenceDrainTarget[]`；`[]`=no-op；缺席 target=no-op | lifecycle.ts:841-843 scope Set；S-4 双锚 | 忠实，与 SA6 契约临时形状逐字段一致 | — |
| DD-5 drain 语义与状态机（§8 骨架逐行） | lifecycle.ts:840-879——`closed` 早退（vacuous）/ 非 live 跳过 / 回退窗+在途被动等待（仅注册 waiter）/ idle-脏强制 `startFlush` / 干净跳过 / `Promise.all` 屏障后重扫 | **逐行一致**（含注释）。扫描段同步完成 waiter 注册（单线程内 check-then-push 原子）；`startFlush` 同步置 `flushing=true` 后才遇首个 await ⟹ 注册的 waiter 必被该 flush finally 释放 | — |
| DD-5b 驱逐路径通知面补全（4 处移除点） | `releaseSettleWaiters`（lifecycle.ts:1227-1230）+ 四调用点：settleEntryForDelete 驱逐腿（:679）/ settleEntryForArchive 干净驱逐腿（:709）/ dispose 同步段（:831）/ maybeEvict（:1195） | 忠实。live-entry 移除点全集枚举核对：其余 `cells.delete` 均作用于非 live claim cell——drain waiter 只注册在 live entry 上，不可达 ⟹ 枚举完备 | — |
| DD-6 DSH 探针锁步 + 记录头冻结 | probe.ts:444-447 一行镜像 + 注释；record.ts/events.ts/profile.ts/cli.ts 零改动 | 忠实 | — |
| DD-7(1) app 停机第 3 步预算组合 drain，file/memory 统一 | app.ts:297-312（两分支统一保留 plugin 句柄）、:618-627（`kind==='file'` 守卫删除；file 预算 = `schedule?.maxDirtyMs ?? DEFAULT_MAX_DIRTY_MS` + 边距，memory = 缺省 5_500）、:547-568（`awaitDrainWithBudget` tagged-outcome race + timer 早清，镜像 rest-hosting 先例） | 忠实。boot 窗口 `instance === undefined` 跳过（F2）；工厂 `instance` 在 `apply` 内赋值——`ctx.plugin()` 同步调 apply ⟹ 停机时句柄可达 | — |
| DD-7(2)(3)(4) config/main 注释刷新 + 停机时序 | config.ts:13-44/:278（拒绝文案 parenthetical 更新，路径段保持——app-config-red:299 与 lifecycle-watchdog-red:122 只钉路径段，零破坏）；main.ts:96-103 仅注释 | 忠实，行为零变化 | — |
| DD-8(1) ADR 0006 修订节 7 条 | docs/adr/0006...md:242-282：接口契约 / drain 语义 / 停机硬契约（无条件 + 适用面 + :34 关系 + 实施注记）/ dispose 对齐（修订并扩展 :86）/ retryDelayMs 解析形状 / 排空通知面不变量 / 非 live cell 排除存档 | 忠实——Owner O1/O2、SA8 D1/D8/D15/O3 全部落入成文条款 | — |
| DD-8(2)(3)(4) CONTEXT 词条（含 `_Avoid_`）/ hub-peer 词表+停机序 / cordis-plugin-hosting 硬契约+示例 | CONTEXT.md:139-142；hub-peer-deployment.md:36-46/:277-289（条件性注记 SA2-8 + memory 缺省预算括注 SA2-13）；cordis-plugin-hosting.md:64/:98-133/:455-478 | 忠实 | — |
| 备选实现核对（SA3 deviations 1-3） | S-5a/S-5b 夹具参数替换（确定性构造）、S-5b `elapsedMs>=500`/tmpPath 强化断言、`releaseSettleWaiters` 抽方法 | 均为等价实现选择，非语义偏离；设计 §12 S-5b 明文允许机制等价替换 | — |

## B5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| drain 状态机（扫描/强制 flush/等待/重扫） | `PersistenceLifecycle`（ADR 0006:157-159 lifecycle core 共享） | lifecycle.ts 单点；Memory/File 纯委派 | 正确——无状态机复制 |
| drain 的 targets 输入校验 | File adapter（路径安全事实所有者） | file.ts:151-154 `validateIdentity`（与其余公开入口同款） | 正确 |
| 停机预算与诚实事件 | 宿主组合层（app） | app.ts `awaitDrainWithBudget` + 事件；库级 drain 无预算参数 | 正确（分层与 Owner 评论一致） |
| retry 基准单源 | lifecycle（调度事实所有者） | `retryBaseMs` getter，两落点共用 | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| 有界停机排空 | REST `restHost.drain(REST_DRAIN_BUDGET_MS)`（app.ts:92-96/:591；rest-hosting tagged-outcome race + timer 早清） | `awaitDrainWithBudget` 同款纪律（进程级 setTimeout、早清、败者续体语义文档化） | 一致（有意差异已注释：app 不 abort drain——abort 等价物是随后的 dispose） | 复用既有纪律而非新造机制 |
| 私有强制排空先例 | `settleEntryForArchive`（lifecycle.ts:698-720） | drain 与之同构、去掉归档前置/驱逐腿、去掉 `handles.size>0` 拒绝 | 一致（泛化，非复制） | 同一 waiter 通知面 + 同一 startFlush |
| degraded 回退窗尊重 | `scheduleRetry`/ADR 0006:195 | drain 被动等待（注册 waiter） | 一致 | 退避仍是唯一调度源 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| entry 结算完成 | flush finally 通知点 1 / dispose 通知点 2 / 4 处驱逐释放（`archiveWaiters` 单通知面） | drain/settleEntryForArchive/settleEntryForDelete 共同消费 | 无——未引入第二套 waiter/事件机制 |
| retry 首基准 | `schedule.retryDelayMs ?? debounceMs`（`retryBaseMs` 单 getter） | entry.retryDelayMs（运行态） | 无——两落点均改引单源 |
| 排空预算 | `maxDirtyMs + DRAIN_MARGIN_MS`（配置推导） | 事件载荷 budgetMs | 无——零新增配置键 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| drain 不获取任何资源（无 abort/destroy/清定时器/驱逐） | 无对应释放义务；宿主预算 timer 一次性早清 | 败者 drain 续体由 dispose 通知点 2 收口（vacuous resolve，零 unhandled rejection——store 失败面永不 reject） | 对称（additive 能力，无新资源） |
| plugin 句柄获取（boot 两分支统一赋值） | 句柄随 app 实例生命周期；instance 经 `get instance()` 只读 | boot 窗口 undefined → 停机跳过（F2，与 restHost/diagnostics 同款 optional 纪律） | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二套 cleanup/retry loop | lifecycle 内部退避 | drain 复用（不新造重试） | 无平行 |
| 第二拆卸链 | `performStop` 单链 | drain 是链内等待步（diagnostics-closed 与 persistence-disposed 之间），`stop()` single-flight 不变；S-5c 二次 stop 断言 drain 恰一次 | 无平行（apps AGENTS 纪律保持） |
| 第二事件通道 | stdout NDJSON sink | 新事件走同一 sink（`{event, budgetMs}`，脱敏合规——纯数值） | 无平行 |

## B6. 文件范围审查（iteration 0，已提交为 75bd0ab）

15 行 ALLOW 全部兑现（contract/lifecycle/memory/file/index、probe、app/config/main、ADR 0006、CONTEXT、hub-peer、cordis-hosting、两新增测试）；DENY 零触碰（service.ts/testing.ts/namespace-registry/dsh 四文件/persistence 冻结审计/SA6 两契约文件/yjs-server 既有测试/docs:protocols/ws-replication/上游 wiki 产物）。本轮（iteration 1）增量范围见 §A6。

## B7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `DocPersistence.drain?` 新 optional 成员 | 第三方实现/13 stub/wrapIo 字面量 | optional ⟹ 编译零破坏；surface 测试 `legacyThreeMemberAdapter` 三成员字面量保持绿 | 无 | — |
| `PersistenceSchedule.retryDelayMs?` | `Partial<PersistenceSchedule>` 消费方（两 adapter options、DSH profile） | 自动获得可选键；app 配置面有意不暴露（设计非目标，config 词表两键闭集不变） | 无 | — |
| 新事件 `persistence-drain-budget-exceeded{budgetMs}` | stdout NDJSON 消费方/运维 | additive；hub-peer-deployment 词表已同步（含条件性注记）；既有 findIndex 严格递增锚对词表新增免疫 | 无 | — |
| yjs-server 停机链 callers（SIGTERM/SIGINT/SIGHUP/fatal-exit） | main.ts 全部经 `app.stop()` | 预算内必然返回 ⟹ watchdog 退居兜底；换装注释已刷新 | 无 | — |
| registry shutdown → drain 前置 | `namespace-registry` | 零改动（SA8 D12）；lease 全释放后无并发写者——drain 静息观察点边界由链路前置条件关闭 | 无 | — |
| `MemoryPersistence.prototype.drain` 原型面 | S-5c spy / 仓库外宿主 | barrel 公开导出；vitest alias 同映射 ⟹ 单模块实例 | 无 | — |
| DSH golden 消费方 | determinism/acceptance 测试 | 缺省时间线逐字节不变（静态等价） | 无 | — |

## B8. 错误、恢复与并发

- **drain 失败面**：store 失败沿既有 degraded + 内部退避吸收（flush catch → scheduleRetry），drain 永不因 store 失败 reject（lifecycle.ts:1148-1157 无 rethrow；waiter 由 flush finally 无条件释放）。File unsafe target 的 loud `Error` 是文档化例外通道（S-4 专项锚定）。
- **静默失败检查**：预算尽路径**不静默**——事件先于有损 dispose（S-5b 断言 `budgetIndex < indexOf('persistence-disposed')` 且 `budgetMs === 520`）；app-stop-failed 计数为 0 断言排除伪装。dispose 有损语义保持（S-1/0a/0b 锚定）。
- **并发/竞态静态核验**（重点攻击面，均通过）：扫描-注册原子性（同步块 check-then-push；`startFlush` 同步置 `flushing` ⟹ 注册 waiter 必被释放）；双 flush（双门 + armed 陈旧定时器经 `flushing`/干净守卫早退——1a attempts 恰 2、1g attempts 恒 3 锚定）；驱逐×drain 挂起（4 处移除点全部释放，S-3 行为锚定）；dispose×drain（通知点 2 + `closed` 早退 vacuous，S-1）；等待期再脏（屏障后重扫强制 flush，S-2）；单飞/幂等（多次 drain attempts 精确递增；`stop()` single-flight 下 drain 恰 1 次，S-5c）；终止性（每 waiter 由通知点 1/2 或驱逐释放）。
- **进程重启/事务中断**：drain 不改持久化格式与提交点（复用 `io.write`，rename 提交语义不变）；S-5b「新实例见旧 committed 快照 + tmp 目录仍在」诚实锚定有损边界。
- **静态无法完全确认项**：真实慢盘下 30.5s 预算的充分性、nomic-server（仓库外）采纳——列入 §A11/§B11。

## B9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| SA6 `persistence-issue-412-drain-red.test.ts`（27 tests：§0 4 / §1 14 / §2 6 / §3 3） | 0a/0b 缺口正复现；1a-1g drain 全语义；2a/2b/2c retry 基准/缺省/退避 cap；3a-3c 保持性 | root `pnpm test` 分片 + SA6/设计 §12 显式命令 | 无 skip/only/todo（grep 核实） | — |
| SA6 `persistence-issue-412-drain-surface.test-d.ts`（5） | 类面 drain / schedule 键 / 三成员字面量 / 实现关系 | CI typecheck 作业（`*.test-d.ts` include） | 无 | — |
| 新增 `persistence-issue-412-drain-semantics.test.ts`（9） | S-1 vacuous；S-2 等待期再脏重扫；S-3 驱逐释放 waiter；S-4 `[]`/缺席/全量 + File unsafe target | root 分片 | 双 adapter 矩阵；withTimeout 全覆盖；零源码字符串断言 | — |
| 新增 `apps/yjs-server/test/persistence-drain-shutdown.test.ts`（3） | S-5a 完成式；S-5b 预算内收口 + 有损事实诚实；S-5c drain 恰一次且先于 `persistence-disposed`、二次 stop 幂等 | root 分片（`apps/*/test/**/*.test.ts`）+ app 套件命令 | 真实组合根 + 真实 fs；EISDIR 注入确定性 | MINOR-3（450ms 墙钟上界的 CI 慢机 flake 余量，见 §B12） |
| 既有锚（ordered-shutdown-red / lifecycle-watchdog-red / app-config-red / persistence-contract / dsh determinism） | 四事件序 / 配置边界 / 冻结审计 / golden | 既有入口不变 | 全部零改动即兼容 | — |

**SA6 红灯保持**：契约两文件未被弱化。**Mutation 敏感性**：SA3 三项反证静态核验其可区分性成立；运行级复现列入 §A11 交由后续动态验证。

## B10. Required revisions（iteration 0）

无 BLOCKER / MAJOR finding。（MINOR 项不阻断 approve，见 §B12。）

## B11. 后续动态验证项（iteration 0，承接至 §A11）

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| SA3 报告的验证命令与 mutation 反证的可复现性 | 后续验证角色按设计 §12 Runner 命令 + SA3 mutation 清单复跑 | 242/182 切片全绿；三项 mutation 分别使 S-3/S-5c/S-5a-c 变红后恢复 | 任一 mutation 下对应测试仍绿或切片出现新红 |
| 真实慢盘/高并发下 `maxDirtyMs + 500ms` 预算的充分性 | 部署环境停机画像观测 | 健康 store 停机无预算事件；事件出现率可告警 | 健康 store 频繁触发预算事件 |
| 仓库外宿主（nomic-server）按 cordis-plugin-hosting 硬契约替换固定睡眠 | 消费方仓库 | `FILE_PERSISTENCE_DRAIN_MS` 移除、`drain()` + 自有预算上线 | 消费方继续固定睡眠 |
| S-5a `elapsedMs < 450` 在极慢 CI 上的稳定性 | CI 长期运行记录 | 无偶发红 | 偶发超时红 |
| `drain()` 与 `createDoc`/`importDoc` claim 环交错 | 可选补充测试（设计 §13 follow-up 同族） | claim 完成后新 live 脏 entry 由下一次 drain 覆盖 | waiter 挂起或漏排空 |

## B12. Non-blocking observations（iteration 0，仍适用）

| # | 严重度 | 观察 | 建议处置 |
| --- | --- | --- | --- |
| N-1 | MINOR | `apps/yjs-server/AGENTS.md` 单一拆卸链摘要行未列新增排空等待步（陈述仍真；该文件不在设计 ALLOW，SA3 已记录为文档债） | 后续文档变更集顺带补一句 |
| N-2 | MINOR | `awaitDrainWithBudget`：若 drain promise reject（结构性不可达），`clearTimeout` 被跳过，预算 timer 残留至自然到点；fail-loud 路径不受阻 | 可改 try/finally 早清 timer；非本任务必要 |
| N-3 | MINOR | S-5a 的 `elapsedMs < 450` 墙钟断言在极慢 CI 可能偶发击穿（预算/withTimeout 不受影响） | 观察 CI 稳定性后酌情放宽 |
| N-4 | MINOR（design 侧） | SA2-12：设计文档对 SA8 报告的计数/traceability 停留在旧版（SA1 产物，不在 SA3 ALLOW） | 路由 `design`，不影响实现正确性 |
| N-5 | 观察 | `flush()` finally 的通知点 1 保留内联 `splice(0)+call` 而未调用 `releaseSettleWaiters`（行为逐字节等价） | 纯风格项 |

## B13. 复查标记（iteration 0 历史记录）

iteration 0 曾提交 `requiresConflictRecheck: true`（设计 §15 五项理由）；该职责已由 SA8 实现后冲突复审产物 `wiki/raw/task_issue-412_implementation_conflict_report.md` 承担。iteration 1（本轮）无新增冲突维度（见 §A13）。
