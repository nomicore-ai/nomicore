# SA10 Spec Review — issue #412（iteration 1：codegen-freshness CI 修复轮审查）

- 任务：issue #412（persistence 公开完成式排空 `drain()` + `retryDelayMs` 解耦 + 停机硬契约）
- 本轮 dispatch：`sa-75015d57-e8fe-40dc-a29b-b05d24a47b2e`（phase **spec-review**，iteration 1）
- **审查对象：最终已提交的 CI-repair diff = HEAD 提交 `909476071610923c45e9f19b5229bdfcf395a3bc`「fix(codegen): refresh generated vfs3 assets」**（`git show` 全量逐行核对：3 个产品文件 + 3 个 wiki 过程产物）
- 适用 Owner 要求：Issue comment ID `5751613018`，updated `2026-09-20T18:03:36Z`（MEMBER）——**本轮经 `gh api repos/nomicore-ai/nomicore/issues/comments/5751613018` 独立拉取全文核对**：id/updated_at/author_association 与 dispatch 逐项一致；要求三件套 = ①「宿主优雅停机必须先 `await drain()` 再 dispose」写为**硬性契约**而非参考建议；②同步修订 ADR-0006 :86 对 dispose 的现有定义（否则契约与实现继续脱节）；③可接受分层方案（公开 `drain()`，dispose 保持 abort 式）——另含第三击穿窗口（degraded retry 回退窗）与问题 2 解耦（缺省保持现行为）的复核确认。dispatch 转述与原文一致
- 审查纪律：spec 审查。未修改任何代码/设计/测试、未运行测试套件、未启动服务、未调度其他 SA。运行期绿证据 = SA3 申报 + SA4 静态核验 + 本审查的**只读字节谱系核验**（sha256sum/git 考古/grep 锚点）与**一次只读 CI 步骤复跑**（`pnpm generate --check`——ci.yml 中 codegen-freshness job 的唯一步骤；cli.ts:115 证实 check 模式只全量重生成到内存并逐字节 diff，零写盘；跑后 `git status --porcelain` 为空）
- 历史轮次：**iteration 0**（dispatch `sa-2cf05a4a-…`）审查 #412 主体实现 diff（已提交为 `75bd0ab`），verdict **approve**——该结论本轮复核保持（见 §4/§5：主体实现逐字节未被修复轮触碰，关键锚全部在位）

## Verdict

**approve**（0 × BLOCKER / 0 × MAJOR；4 × 非阻断观察项见 §7；PR 必须披露项见 §8）。

核心判定：

1. **修复了具体失败**：CI job `codegen-freshness` 的唯一步骤 `pnpm generate --check`（`.github/workflows/ci.yml:147`）由修复前 exit 1（「生成物过期（diff 非空）：domains/vfs3-assets/generated.ts」）恢复为 **exit 0——本审查在原命令上亲自复跑确认**；根因（发布提交 `abbb89a` 版本 bump 0.1.3→0.2.0 未伴随重生成）归属成立，修复走的是 ADR 0005 §4 与 `domains/AGENTS.md` §Workflow 的规定动作（重生成而非手改生成文本）。
2. **最小且正确**：产品 diff = 生成物头注横幅**恰 1 行** + 两字节哨兵各 `GENERATED_SHA256` 1 行重钉 + 2 行原因注释；语义中性有三重独立字节锚（见 §3），全部经本审查独立复算一致。
3. **Owner 硬契约与 ADR 对齐零改动**：修复提交对 `packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/**`、`CONTEXT.md`、`docs/integration/**`、`packages/dsh-persistence/**` 的 diff **为空**；ADR 0006 修订节（:242-282，含 :270 无条件硬契约条款与 :276「修订并扩展 :86」对齐条款）与 app.ts 结构性强制（`awaitDrainWithBudget` :559 → drain :624 → 唯一 `persistenceFiber.dispose()` :630）在 HEAD 逐项在位、逐字节保持 `75bd0ab` 提交态。

## 1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| Issue #412 正文（`wiki/raw/task_issue-412.md` 快照） | 已读 |
| Issue comment 5751613018 全文（`gh api` 本轮独立拉取） | 已读核对 |
| CI-repair diff：`git show 9094760`（6 文件全量）+ `git diff 75bd0ab..9094760 -- <#412 全部契约面路径>`（输出为空） | 已读 |
| `wiki/raw/task_issue-412_sa3_impl.md`（本轮更新版：诊断/根因/修复/验证申报） | 已读并交叉核对 |
| `wiki/raw/task_issue-412_sa4_review.md`（Part A 本轮 verdict **approve**，0 finding；Part B iteration 0 approve 保持） | 已读 |
| `wiki/raw/task_issue-412_implementation_conflict_report.md`（SA8 实现后复审本轮 verdict **clear**，requiresConflictRecheck **false**；13 项对照 = 12 no-conflict + 1 implements-existing-decision） | 已读 |
| `wiki/raw/task_issue-412_design.md`（iteration 2，§11 ALLOW/DENY 两表） | 已读（范围核对用） |
| `.github/workflows/ci.yml`（codegen-freshness job :128-147）、`packages/vfsl-codegen/src/{cli,header}.ts`、`domains/AGENTS.md` §Workflow | 已读 |
| 字节谱系只读核验：`sha256sum`（现生成物/旧生成物/schema.vfsl）、`git log`（generated.ts/schema.vfsl/生成器与 vfsl src）、`git show abbb89a/2fdac1b` | 已执行（见 §3） |
| HEAD 锚点 grep：ADR 0006 :242/:246-282 七条款、app.ts :554-630、两哨兵测试全文（number-literals 52 行逐行） | 已读 |

## 2. 具体 codegen-freshness 失败：症状、根因与归属（核对属实）

| 项 | 事实 | 本审查核验 |
| --- | --- | --- |
| 失败症状 | CI `codegen-freshness` job 唯一步骤 `pnpm generate --check` exit 1——「生成物过期（diff 非空）：domains/vfs3-assets/generated.ts」；仓内负控 `generate-union-member-docs.test.ts`（:529 regen 输出 vs 盘上全字节比对 / :538 spawn `--check` 期望 exit 0）同步红 | ci.yml:147 步骤原文确认；负控两断言与 iteration 0 报告披露的「2 个既有失败」机械构成一致（SA4 §A7③ 同款结论） |
| 根因 | `header.ts:4-8` 按设计在生成时运行时读取本包 `package.json` 版本写入头注横幅；发布提交 `abbb89a` 把 `packages/vfsl-codegen/package.json` 0.1.3→0.2.0（`git show` 核对 +0.2.0）但**未重生成**（`git show --stat abbb89a -- domains/` 为空）；生成物自 `2fdac1b` 起未再重生成（`git log` 核对）——此后 `--check`（全量重生成 → 逐字节 diff）在任何提交上恒红 | 全部独立复算属实 |
| 归属 | 仓库级历史遗留，**非 #412 变更集引入**：`75bd0ab`（#412 主体）对 `domains/**`、`packages/vfsl*/**` 零触碰（`git show --stat` 核对）；#412 分支 CI 首次真实跑到该 job 将其暴露 | 属实 |

## 3. 修复正确性与最小性（字节级证明链，全部独立复算）

| # | 锚 | 期望值 | 实测 | 判定 |
| --- | --- | --- | --- | --- |
| 1 | 现 `domains/vfs3-assets/generated.ts` sha256 | = 两哨兵新钉值 `a934f62d…d65b` | `sha256sum` = `a934f62d4e5ec287e604b109e85454eefbf5e042756479f216a878deb7c3d65b` | ✅ 逐字节一致 |
| 2 | 旧（`75bd0ab`）生成物 sha256 | = 旧钉值 `342d8c1f…e6707` | `git show 75bd0ab:… \| sha256sum` = `342d8c1fe0814409f682852c13748260b9d6cbda125afe0e815a8de3298e6707` | ✅ 一致 |
| 3 | 修复 diff 形状 | 最小 | `git show 9094760 -- domains/vfs3-assets/generated.ts` = **1 insertion / 1 deletion**，唯一行 = 头注第 3 行 Generator 横幅 | ✅ 恰 1 行 |
| 4 | 横幅版本 | = 当前生成器包版本 | 头注 `@nomicore/vfsl-codegen@0.2.0` = `packages/vfsl-codegen/package.json` `"version": "0.2.0"` | ✅ 一致（版本自同步设计内行为，非手改） |
| 5 | `Source hash` | = 未动 schema 的哈希 | 头注 `sha256:82e98fa1…b93c69` = `sha256sum domains/vfs3-assets/schema.vfsl`；schema 自 `526ee4f` 零改动（`git log`） | ✅ 无源漂移 |
| 6 | 语义锚零漂移 | 指纹常量与断言不动 | 两哨兵 `ENVELOPE_FINGERPRINT`/`SEMANTIC_FINGERPRINT`（`sha256:v1:7b6c19…`/`b71be7…`）常量与全部断言**零改动**（number-literals 全文 52 行逐行读：3 tests、无 skip/only/todo、断言面完整；int-range diff 同款仅钉值+注释） | ✅ |
| 7 | 域全集 | 无第二个陈旧生成物 | `ls domains/` 仅 `vfs3-assets`；哨兵断言 `FileSchemaSource.list() === ['vfs3-assets@1']`；`--check` 为全量重生成 + 孤儿检测（cli.ts:115-141） | ✅ |
| 8 | **终判：CI 步骤复跑** | exit 0 | 本审查执行 `pnpm generate --check`（CI :147 原文）→ **EXIT=0**；跑后 `git status --porcelain` 为空（check 模式零写盘） | ✅ **新鲜度恢复实证** |

**裁决核对**：被否备选（改 `header.ts` 钉死/移除版本横幅）会削弱 ADR 0005 §4 的生成器漂移警报并触碰 `packages/vfsl-codegen/**`；回滚重生成则 `--check` 永久红（版本不可回退）。所选路径（规定动作重生成 + 哨兵按自述工作流「重新生成即此处先红 → 确认语义中性 → 重钉」）是同时恢复 `codegen-freshness` 与 root `pnpm test` 的**唯一语义中性路径**——裁决正确。哨兵重钉后钉值 = 当前真实字节，对后续任何 `domains/vfs3-assets/**` 改写继续 fail-loud，敏感性由构造保持。

## 4. Issue #412 要求保持性（零交集证明）

- `git diff 75bd0ab..9094760 -- packages/persistence apps/yjs-server docs/adr CONTEXT.md docs/integration packages/dsh-persistence packages/namespace-registry docs/protocols packages/ws-replication` → **输出为空**；修复提交文件清单恰 6 项（3 产品 + 3 wiki 过程产物），与 #412 主体实现 27 文件零交集。
- issue 正文全部请求面（公开 drain、retryDelayMs 解耦、宿主固定睡眠替换）由 `75bd0ab` 落地并经 iteration 0 本角色 **approve**；修复轮在物理上不可能影响该语义（不同文件）。#412 两份 SA6 契约测试（27 运行期 + 5 类型）与新增 S-1~S-4/S-5a~S-5c 锚文件均零触碰。
- **iteration 0 披露项 4 闭环**：「root `pnpm test` 2 个既有失败（版本横幅新鲜度）与本 diff 零交集、发布提交遗留」——本轮修复正是该遗留的关闭动作；SA3 申报修复后 root `pnpm test` 435 files / 5242 tests 全绿、`pnpm typecheck` exit 0，与 SA4 静态核验及本审查 §3-8 的 `--check` 实证互洽。

## 5. Owner 评论 5751613018 硬契约与 ADR 对齐保持性（逐项在位）

| Owner 要求（gh 全文核对） | HEAD 现状锚点 | 判定 |
| --- | --- | --- |
| 硬契约：dispose 前必须 await drain（成文，非参考建议） | ADR 0006 修订节第 3 条（:270）：「**宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`**——至 drain 完成，或至宿主显式预算耗尽且该事实可观察……预算尽后继续 dispose 是硬契约的**显式可观察退出**，不是违约」；条款头明文引用 comment 5751613018 | **保持**（修复轮零触碰） |
| 同上（自家实现结构性强制） | app.ts :559 `awaitDrainWithBudget` → :624 `await this.awaitDrainWithBudget(adapter.drain(), budgetMs)` → :625 预算尽 `persistence-drain-budget-exceeded` 事件 → :630 全仓**唯一** `persistenceFiber.dispose()`；file/memory 统一无 kind 特判 | **保持**（逐字节 = `75bd0ab`） |
| ADR-0006 对齐（同步修订 :86 dispose 定义） | ADR 0006 :242 修订节头（owner 要求三句成文）+ 第 4 条 :276「本节**修订并扩展** :86 的 dispose 定义边界」——dispose 保持 abortive/有损、从来不是持久性屏障、dispose 前持久性唯一经分层 drain 表达、两者不合并 | **保持** |
| 分层公开 drain + dispose 保持 abort 式 | 修订节七条款（:246/:261/:270/:276/:278/:280/:282）完整在位；`DocPersistence.drain?` optional 分层成员与 dispose 冻结语义由 `75bd0ab` 承载，本轮零触碰 | **保持** |

## 6. 验收证据交叉核对

- **本审查直接实证**：CI 目标步骤 `pnpm generate --check` exit 0（§3-8）；字节谱系四锚复算一致（§3-1/2/4/5）。
- **SA3 申报**（修复后）：`pnpm generate --check` exit 0；root `pnpm test` 435 files / **5242 tests 全绿**（修复前 2 failed / 5240 passed = 两重生成触红的哨兵）；root `pnpm typecheck` exit 0（15 段）；vfsl 54 files/1156、vfsl-codegen 12 files/119、domains 3 files/31、domains-scaffold 2 tests 全绿。各计数互洽（5240 + 2 重钉哨兵 = 5242；失败构成与负控两测/两哨兵的时序归因一致）。
- **SA4 静态核验**：Part A verdict **approve**（0 BLOCKER/MAJOR/MINOR），钉值/横幅/Source hash 三重复算与本审查一致；生成器三次 src 变更（ADR 0019/0020/0024）不改本域输出的排除链完整，且「若排除链有漏则 CI :147 与负控 :529 必红」——本审查的 `--check` exit 0 实证恰好闭合该逃逸路径（负控 :538 即同一命令）。
- **SA8 冲突门**：**clear**（12 no-conflict + 1 implements-existing-decision = 恢复 ADR 0005 §4 被 `abbb89a` 落空的保鲜义务；0 evolution-required / 0 hard-conflict），requiresConflictRecheck **false**；冻结面（schema、Source hash、指纹前缀、生成器源码、CI 工作流、#412 全部契约面）逐项核对保持。
- 两哨兵「按构造通过」：钉值 = 现文件实测 sha256（本审查复算）；负控「按构造通过」：盘上字节 = regen 输出（`--check` exit 0 即其充要条件）。

## 7. Findings（全部非阻断观察项）

| # | 严重度 | 观察 | 处置 |
| --- | --- | --- | --- |
| O1 | MINOR（流程） | 修复的 3 个产品文件不在 #412 设计 §11 ALLOW/DENY 两表内（设计未预见仓库级 codegen 漂移）；扩权依据 = 本轮修复 dispatch 明示指令 + `domains/AGENTS.md` §Workflow 规定动作；SA3 已透明申报，SA8 裁决无决策抵触、范围认定留 Controller | PR 披露（§8-1） |
| O2 | MINOR（流程） | 两哨兵属已闭合任务 #314/#315 的验收测试，本轮修改其钉值——属哨兵自述设计路径（「重新生成即此处先红」→ 确认 → 重钉），语义中性三重锚内联注释记录；断言与语义指纹零改动 | PR 披露（§8-2） |
| O3 | 观察 | 已闭合任务 #314/#315/#316 的冻结 wiki 记录仍以旧钉值 `342d8c1f…` 描述当时基线——历史过程产物，非活门禁，无漂移风险（SA4 R-1 同款） | 不处置 |
| O4 | 观察（流程建议） | 后续凡 bump `@nomicore/vfsl-codegen` 版本的发布变更集应同集执行 `pnpm generate`（ADR 0005 §4 原子性精神），避免重造本类仓库级红色报警态（SA8 required action 1） | 随后续发布流程顺带 |

无 BLOCKER / MAJOR。本审查独立复核未发现上游 SA 记录之外的新缺口。

## 8. PR 必须披露项

1. **范围扩权事实**：CI 修复触及的 `domains/vfs3-assets/generated.ts` 与两哨兵测试不在 #412 设计 §11 文件范围两表内；权属 = 修复 dispatch 明示指令 + domains/AGENTS 规定动作（SA3 申报、SA8 认定交 Controller）。
2. **跨任务测试重钉**：issue #314/#315 字节哨兵的 `GENERATED_SHA256` 由 `342d8c1f…e6707` 重钉为 `a934f62d…d65b`——重生成唯一差异 = 生成器身份横幅 0.1.3→0.2.0；envelope/semantic 指纹、生成物 Source hash、全部断言零改动（语义零漂移，哨兵对后续改写继续 fail-loud）。
3. **根因归属**：失败为发布提交 `abbb89a` 历史遗留（版本 bump 未伴随重生成），非 #412 变更集引入；本修复同时关闭 iteration 0 SA10 披露的「2 个既有失败」项。
4. **动态终判留 CI**：`pnpm generate --check` 本地复跑 exit 0（本审查实证）；CI 环境 `codegen-freshness` job 转绿以 push 后实际运行终判（SA4 §A11 同款登记）。
5. 承接 iteration 0 未变披露项（与本轮修复零交集，仍有效）：库级 drain 无时间预算（宿主预算 = 总界）；nomic-server 仓库外固定睡眠替换待消费方采纳；DSH 记录头 retryDelayMs golden、配置面暴露 retryDelayMs 等 follow-up；iteration 0 的 M1–M5 文本/余量债不阻断。

## 9. 结论

最终已提交的 CI-repair diff（HEAD `9094760`）忠实达成其 spec：以**最小安全改动**（规定动作重生成 + 哨兵按设计路径重钉）修复了具体的 `codegen-freshness` 失败——本审查以 CI 原文命令复跑 exit 0 实证；**未改动** Owner 评论 5751613018（updated 2026-09-20T18:03:36Z，gh 全文核对）要求的 drain-before-dispose 硬契约（ADR 0006 :270 成文条款 + app.ts :559-630 结构性强制，逐字节保持 `75bd0ab`）与 ADR 对齐（:242-282 修订节七条款含 :276「修订并扩展 :86」）；issue #412 全部要求与验收证据链（SA3 申报 ↔ SA4 静态 ↔ 本审查字节谱系）互洽闭合；无 scope creep（wiki 过程产物随集入库属 MABF 证据链惯例）。iteration 0 对主体实现 `75bd0ab` 的 **approve** 结论保持。**approve**。

---

## 附：iteration 0 结论存档（dispatch `sa-2cf05a4a-8931-4f38-a72e-35048838f4b6`，审查对象 `c3f7bd9..1fef434`「feat(persistence): add completion drain lifecycle」，后由 Controller 提交为 `75bd0ab`）

**approve**（0 BLOCKER / 0 MAJOR；5 × MINOR 非阻断）。核心判定：issue 正文全部请求面、Owner 评论 5751613018 全部要求、SA6 验收契约 C1–C14 与补充锚 S-1~S-4/S-5a/S-5b/S-5c 逐项忠实落地；ADR-0006 对齐（修订节 7 条 + :86「修订并扩展」）与停机硬契约在规范条款、对外指引、自家实现（file/memory 统一）、验收证据四方同答案；文件范围贴合设计 ALLOW 15 行、DENY 零触碰。PR 披露项：库级 drain 无预算、nomic-server 仓库外采纳、设计 §13 follow-up、~~2 个既有失败（codegen 横幅新鲜度）~~（**本轮已关闭**，见 §8-3）、M1–M5 文本/余量债。本轮复核：该 verdict 的对象（`75bd0ab` 提交态）经修复轮逐字节保持，结论无需修订。
