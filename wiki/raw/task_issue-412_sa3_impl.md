# SA3 Implementation Report

- 任务：issue #412（persistence：公开完成式排空 `drain()` + `retryDelayMs` 与 `debounceMs` 解耦 + 宿主停机硬契约）
- Worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`）
- 实施基线：`75bd0ab feat(persistence): add completion drain lifecycle`（#412 主体实现已提交，工作区入口干净）
- 本轮范围：dispatch `sa-e9a1ce33-3122-49d0-8c27-fc2ec0acd0ea`（implementation，iteration 1）——**诊断并修复失败的 `codegen-freshness` CI 检查**（最小安全改动），保持已批准的 #412 语义
- 实施依据：`wiki/raw/task_issue-412_design.md`（**iteration 2**，SA2 verdict **approve**，SA8 设计后复查 **clear**）+ SA6 契约两文件（零触碰）+ 本轮 dispatch 的 codegen-freshness 修复指令 + `domains/AGENTS.md` §Workflow
- Owner 要求：Issue comment ID `5751613018`（updated 2026-09-20T18:03:36Z）——dispose 前 await drain 的硬契约、ADR-0006 对齐、dispose 保持 abortive 时保留分层公开 drain

## Inputs consumed

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-412.md` | 已读 | Issue 正文（缺口 1/2、消费方证据、请求面） |
| `wiki/raw/task_issue-412_design.md` | 已读（全 558 行，iteration 2） | 实施唯一依据：DD-1~DD-8、§8 状态机骨架、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-412_sa6_contract.md` | 已读 | 契约项 C1–C14、红灯归因、Runner 触发命令、S-5 缺口 |
| `wiki/raw/task_issue-412_sa2_review.md` | 已读（§13/§14 修订映射） | SA2-1~SA2-13 落实核对（iteration 2 已 approve，0 BLOCKER/0 MAJOR） |
| `wiki/raw/task_issue-412_design_conflict_report.md` | 已读（§D1/D8/D19、O1–O3、行动 1–5） | SA8 约束：ADR 修订同变更集、不得物化缺省 retryDelayMs、预算注释诚实性、liveness 不变量 |
| `packages/persistence/test/persistence-issue-412-drain-red.test.ts`、`persistence-issue-412-drain-surface.test-d.ts` | 已读，**零触碰** | SA6 红/绿契约（运行期 27 + 类型面 5） |
| `packages/persistence/AGENTS.md`、`apps/yjs-server/AGENTS.md`、`docs/AGENTS.md`、模块 AGENTS | 已读 | 契约边界 + 验证门（root typecheck/test、app typecheck/test） |
| `.github/workflows/ci.yml`（`codegen-freshness` job :124-147） | 已读 | 本轮修复目标：该 job 唯一步骤 = `pnpm generate --check` |
| `domains/AGENTS.md`、`packages/vfsl-codegen/AGENTS.md`、`packages/vfsl/AGENTS.md`、`packages/vfsl-codegen/src/header.ts` | 已读 | 本轮修复依据：生成物刷新规定动作、生成器不手改、版本横幅自同步设计意图、验证门 |
| `packages/vfsl/test/number-literals-fixture-drift.test.ts`、`int-range-fixture-drift.test.ts` | 已读（本轮重钉对象） | issue #314/#315 SA6 §4 字节哨兵（修复前被重生成触发） |

## Existing worktree reconciliation

- 工作区此前**无** `wiki/raw/task_issue-412_sa3_impl.md`、无未提交实现改动：`git status` 仅含 SA6 两份契约测试与 Host/SA1/SA2/SA6/SA8 报告（untracked），`packages/persistence/src/` 零改动（SA6 §16 参考实现已恢复，md5 复核）。
- 上一轮从零实施，未保留任何过时/冲突实现；SA6 两份契约文件保持逐字节未触碰（提交后仍无 diff）。

### 本轮（codegen-freshness 修复轮）入口状态

- `git status --short` **干净**：上一轮全部产物（13 修改文件 + 2 新增测试 + wiki 报告）已由 Controller 提交为 `75bd0ab`（`git show --stat HEAD` 27 文件核对）。
- #412 主体实现（`packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/0006-*.md`、`CONTEXT.md`、docs/integration/**）在提交后**逐字节未触碰**——Owner 硬契约（drain-before-dispose）与 ADR-0006 对齐文本保持已批准状态。
- 本轮仅在 `75bd0ab` 之上增量修复 CI 的 `codegen-freshness` 失败项；`git status` 出口恰 3 个修改文件（生成物 1 + 因重生成而必须重钉的字节哨兵 2，见下节）。

## Changed paths

| Path | Design section | Change |
| --- | --- | --- |
| `packages/persistence/src/contract.ts` | DD-1/DD-2/DD-3/DD-4/DD-5 | 新增 `PersistenceDrainTarget`；`DocPersistence.drain?` optional 成员 + 完整语义 doc-comment（范围/静息观察点/非破坏性/无预算/失败面）；`PersistenceSchedule.retryDelayMs?`；`resolvePersistenceSchedule` 条件展开（校验环经 `Object.entries` 自动覆盖新键） |
| `packages/persistence/src/lifecycle.ts` | DD-2/DD-5/DD-5b | 公共 `drain(targets?)`（§8 骨架逐条落地）；`retryBaseMs` getter 单源 + 两落点改引（:1091/:1149）；`releaseSettleWaiters` 统一释放 + 四处移除点（dispose / delete 驱逐腿 / archive 干净驱逐腿 / maybeEvict）调用；`archiveWaiters` 字段注释更新（SA2-4） |
| `packages/persistence/src/memory.ts` | DD-1 | `drain` 委派方法（`saveDoc` 邻位，getStatus 邻区） |
| `packages/persistence/src/file.ts` | DD-1 | `drain` 委派方法 + 入口 targets `validateIdentity`（SAFE_PATH_SEGMENT 双段；`targets === undefined` 无校验路径） |
| `packages/persistence/src/index.ts` | DD-1 | barrel 导出 `type PersistenceDrainTarget` |
| `packages/dsh-persistence/src/probe.ts` | DD-6 | 退避镜像锁步：`let delay = (schedule.retryDelayMs ?? schedule.debounceMs) \|\| 1` + 注释 |
| `apps/yjs-server/src/app.ts` | DD-7 | boot 两 kind 统一保留 plugin 句柄（`persistencePlugin` 字段 + 公共工厂 `{apply, get instance()}`）；停机第 3 步固定睡眠 → `awaitDrainWithBudget(adapter.drain(), maxDirtyMs+边距)`（`kind==='file'` 守卫删除）；`awaitDrainWithBudget` 助手（tagged-outcome race + timer 早清）；新事件 `persistence-drain-budget-exceeded{budgetMs}`；两常量注释刷新；文件头/步骤注释更新为硬契约语义 |
| `apps/yjs-server/src/config.ts` | DD-7（SA8 action 4） | 注释刷新：排空**预算**表述 + `MAX_MAX_DIRTY_MS` 诚实性边界（预算覆盖正常路径最坏等待；库级 drain 无上界；预算尽 → 事件 + 有损继续）；`:275` 拒绝文案 parenthetical → `bounded persistence-drain budget`。**行为零变化** |
| `apps/yjs-server/src/main.ts` | DD-7 | **仅注释**：换装链「排空预算窗」表述（file/memory 统一，预算尽有损继续） |
| `docs/adr/0006-server-persistence-docstore.md` | DD-8(1) | 追加「完成式排空 drain、retryDelayMs 与停机硬契约修订（2026-09，issue #412…）」7 条：接口契约 / drain 语义（静息观察点 + 并发写者边界 + `targets: []` no-op + File 校验例外）/ 停机硬契约（无条件 + 适用面不以 adapter 类型特判 + 与 :34 关系 + 实施注记）/ dispose 对齐条款（**修订并扩展** :86 边界、§228-5 重申、分层不合并）/ retryDelayMs 解析形状裁决 / 排空通知面不变量 / 非 live cell 排除裁决存档 |
| `CONTEXT.md` | DD-8(2) | Language 新词条「完成式排空（drain）」+ `_Avoid_` 行（SA2-5） |
| `docs/integration/hub-peer-deployment.md` | DD-8(3) | 事件词表补 `persistence-drain-budget-exceeded`（**条件性注记**——SA2-8）；§停机顺序补有界完成式排空一句（file/memory 统一 + **memory 缺省预算推导括注**——SA2-13） |
| `docs/integration/cordis-plugin-hosting.md` | DD-8(4) | :64 停机句 + 停机清单第 5 步补 drain-before-dispose 硬契约指引（file/memory 统一、degraded 措辞限定耐久 adapter）；**:457-478 示例代码块加入有界 drain 步（SA2-9）**；装配示例改为保留 `persistencePlugin` 句柄并说明原因 |
| `packages/persistence/test/persistence-issue-412-drain-semantics.test.ts`（新增） | §12 S-1~S-4 | 9 tests（双 adapter × S-1/S-2/S-3/S-4 + File 不安全 target 专项） |
| `apps/yjs-server/test/persistence-drain-shutdown.test.ts`（新增） | §12 S-5a/S-5b/S-5c | 3 tests（健康 file 停机链 / degraded file 预算尽 / memory 统一路径原型 spy） |
| `domains/vfs3-assets/generated.ts`（**本轮修复**） | 本轮 dispatch（codegen-freshness）+ `domains/AGENTS.md` §Workflow 2/3 | 经 `pnpm generate` 全量重生成刷新生成器身份横幅 `@nomicore/vfsl-codegen@0.1.3 → 0.2.0`（**唯一一行**；Source hash 与投影类型零变化，见下节诊断） |
| `packages/vfsl/test/number-literals-fixture-drift.test.ts`（**本轮修复**） | 本轮 dispatch 续修（重生成触发的字节哨兵）+ issue #314 SA6 契约 | `GENERATED_SHA256` 重钉 `342d8c1f…e6707 → a934f62d…d65b` + 2 行重钉原因注释；`ENVELOPE_FINGERPRINT`/`SEMANTIC_FINGERPRINT` 与全部断言零改动 |
| `packages/vfsl/test/int-range-fixture-drift.test.ts`（**本轮修复**） | 本轮 dispatch 续修（重生成触发的字节哨兵）+ issue #315 SA6 契约 | 同上（同值重钉 + 2 行注释；语义指纹常量与断言零改动） |

## codegen-freshness CI 失败诊断与修复（本轮）

### 症状复现（修复前）

| 命令 | 修复前结果 |
| --- | --- |
| `pnpm generate --check`（CI job `codegen-freshness` 的唯一步骤，`.github/workflows/ci.yml:146-147`） | **exit 1** — `vfsl-codegen: --check 失败 — 生成物过期（diff 非空）：domains/vfs3-assets/generated.ts` |
| `pnpm generate`（全量重生成后 `git diff`） | 唯一差异 = `domains/vfs3-assets/generated.ts` 头注第 3 行：`Generator: @nomicore/vfsl-codegen@0.1.3` → `@0.2.0`（`1 file changed, 1 insertion(+), 1 deletion(-)`） |

### 根因（与 #412 零交集）

1. `packages/vfsl-codegen/src/header.ts` 按设计**在生成时运行时读取本包 `package.json` 的 `version`** 写入头注（源码 doc-comment 明文：「版本 bump 后头注自动随之变化，regen-diff 自动报警」）——生成物字节 = f(源文本, 生成器包版本)。
2. 提交 `abbb89a chore(release): 发布 0.2.0/0.3.0 能力批次` 把 `packages/vfsl-codegen/package.json` 的 `version` 从 `0.1.3` 提到 `0.2.0`（`git show abbb89a -- packages/vfsl-codegen/package.json` 核对），**但未同步重生成** `domains/vfs3-assets/generated.ts`——该文件自 `2fdac1b` 起未再重生成。
3. 于是自 `abbb89a` 起，仓内生成物永久落后于生成器身份，`--check`（全量重生成 → 逐字节 diff）在**任何**提交上都会报过期。这是发布提交遗留的仓库级漂移，**不是** #412 变更集引入的：`git status`/`git show --stat 75bd0ab` 证实 #412 主体实现零触碰 `domains/**`、`packages/vfsl*/**`；#412 分支的 CI 跑到该 job 时把它暴露出来。

### 最小安全修复（已实施）

- 按 `domains/AGENTS.md` §Workflow 第 2/3 条（「Run root `pnpm generate` to refresh generated projections」「change generator code rather than hand-editing generated output」）执行 `pnpm generate`，刷新生成物——**不手改生成文本**。
- 备选（否决）：改 `header.ts` 去掉版本横幅或钉死常量 → 会削弱 ADR 0005 §4 regen-diff 的生成器漂移警报能力，且触碰 `packages/vfsl-codegen/**`（本次无需），非最小改动。
- **#412 语义保持**：`domains/vfs3-assets/schema.vfsl` 未触碰，生成物的 `Source hash: sha256:82e98fa1…b93c69` 与投影类型逐字节不变；改动仅生成器身份横幅一行。

### 第二层：重生成触发两处字节哨兵，必须同步重钉（本轮一并完成）

- 症状：仅重生成后 root `pnpm test` = `2 failed / 5240 passed`，两处失败**恰为** design §11 DENY 之外的其它任务冻结哨兵：
  `packages/vfsl/test/number-literals-fixture-drift.test.ts:46`、`packages/vfsl/test/int-range-fixture-drift.test.ts:64`（SA6 绿→保持绿契约，issue #314/#315；`9742a28` 建立），二者把 `domains/vfs3-assets/generated.ts` 的 sha256 钉死为 `342d8c1f…e6707`（旧横幅字节）。
- 冲突事实：`codegen-freshness`（ADR 0005 §4，要求重生成）与字节钉值（要求旧字节）在生成器版本 bump 后**不可能同时成立**——`abbb89a` 发布提交只 bump 了版本、未重生成，把仓库留在该不一致态；#412 分支 CI 首次真实跑到 `codegen-freshness` 才暴露。
- 裁决：重生成是 ADR 0005 §4 + `domains/AGENTS.md` §Workflow 的规定动作，且两哨兵 doc-comment 自述「重新生成即此处先红」= 设计上**预期重生成会先红**、由人工/代理确认「重生成是有意的且语义中性」后重钉。本轮据此把两处 `GENERATED_SHA256` 重钉为 `a934f62d…d65b`（各 1 行值 + 2 行注释），并保持：
  - 两哨兵的**语义锚零漂移**：`ENVELOPE_FINGERPRINT`/`SEMANTIC_FINGERPRINT` 两常量**未改**且断言仍逐字节等于基线（该两测试文件中除字节钉值外零改动）；
  - 生成物 `Source hash` 未变 ⟹ schema/IR 语义零漂移；哨兵对后续任何 `domains/vfs3-assets/**` 改写继续 fail loud。
- **范围申报**：`domains/vfs3-assets/generated.ts` 与 `packages/vfsl/test/*fixture-drift.test.ts` 均**不在** #412 设计 §11 ALLOW/DENY 两表内（该设计未预见本仓库级漂移）；二者由本轮 dispatch 的「repair the failed codegen-freshness CI check」指令扩权，且均非 DENY 路径。未触碰生成器源码（`packages/vfsl-codegen/**`）、未改 `schema.vfsl`、未改 #412 两份 SA6 契约文件；#314/#315 两哨兵仅重钉字节值，断言与语义指纹常量零改动。

### 本轮证据（修复后）

| 命令 | 结果 |
| --- | --- |
| `pnpm generate --check`（CI `codegen-freshness` 步骤原文） | ✅ **exit 0**（修复前 exit 1） |
| `npx vitest run packages/vfsl-codegen/test --typecheck --passWithNoTests=false` | ✅ 12 files / 119 tests，Type Errors: no errors（含 `generate-union-member-docs.test.ts` 的 `pnpm generate --check` 负控） |
| `npx vitest run packages/vfsl/test --typecheck --passWithNoTests=false` | ✅ 54 files / 1156 tests，no type errors（含两处重钉哨兵） |
| `npx tsc -p packages/vfsl/tsconfig.json` / `-p packages/vfsl-codegen/tsconfig.json` | ✅ 0 错误 |
| `npx vitest run domains/vfs3-assets/test --typecheck --passWithNoTests=false` | ✅ 3 files / 31 tests，no type errors（含 2 个 `.test-d.ts`） |
| `pnpm exec vitest run packages/vfsl/test/domains-scaffold.test.ts --passWithNoTests=false`（CI `Domain scaffolds check` 步骤原文） | ✅ 2 tests |
| `pnpm typecheck`（root 门） | ✅ exit 0（15 段） |
| `pnpm test`（root 门） | ✅ **435 files / 5242 tests 全绿，exit 0，no type errors**（修复前 `2 failed / 5240 passed` = 两处字节哨兵） |
| `git diff --check` | ✅ 无空白/冲突标记 |

## SA2 Finding落实

| Finding ID | Implementation | Result |
| --- | --- | --- |
| **SA2-1（MAJOR，预算组合）** | `app.ts` `awaitDrainWithBudget`（race + timer 早清，镜像 rest-hosting 纪律）+ 预算 = `maxDirtyMs + 边距`（memory 缺省推导）+ 预算尽 `persistence-drain-budget-exceeded` + 有损继续；config/main 注释一致化 | 已落实——S-5b 实测：预算 520ms 内收口、事件先于 `persistence-disposed`、四事件序完整、旧快照可观察；mutation 反证（恢复固定睡眠）→ S-5a/S-5b/S-5c 全红 |
| SA2-2（静息观察点措辞） | `contract.ts` doc-comment + ADR 修订节第 2 条：终扫后新 ACK 写者不属覆盖范围 + 停机上下文边界；实现按「屏障后重扫直到无 pending」 | 已落实（S-2 锚定等待期再脏被重扫吸收） |
| SA2-3（永不 reject vs File 校验） | `contract.ts`/ADR 显式申明例外通道（输入校验非 store 失败面） | 已落实（S-4 File 专项：unsafe target `rejects.toThrow(/unsafe userId|namespaceId/)`） |
| SA2-4（字段注释） | `lifecycle.ts:96-98` → 「settle 排空路径（archive/delete/drain）填充；驱逐/dispose 路径释放」 | 已落实 |
| SA2-5（CONTEXT `_Avoid_`） | 新词条含 `_Avoid_` 行 | 已落实 |
| SA2-6（契约文件零触碰） | 两份 SA6 文件 `git status` 仍为 untracked、内容未改 | 已落实 |
| **SA2-7（MAJOR，memory 统一）** | `app.ts` 第 3 步删除 `kind==='file'` 守卫；plugin 句柄两分支统一赋值；ADR 硬契约条款保持无条件 + 适用面申明；cordis-plugin-hosting 指引 file/memory 统一 | 已落实——S-5c 实测 memory 停机链 drain 恰一次且先于 dispose；mutation 反证（恢复 file 守卫）→ S-5c 红 |
| SA2-8（词表条件性注记） | hub-peer-deployment 词表注记「仅在停机排空预算耗尽时发射」 | 已落实 |
| SA2-9（示例代码块 drain 步） | cordis-plugin-hosting 停机示例加入有界 drain 步 + 句柄保留说明 | 已落实 |
| SA2-10（「修订并扩展」措辞） | ADR 修订节第 4 条用「本节修订并扩展 :86 的 dispose 定义边界」 | 已落实 |
| SA2-11（§4.1 第三窗口行） | 属设计文档文本；实现侧由 S-5b（degraded 回退窗预算尽）+ 现有 1f 覆盖 | 已落实（实现层证据） |
| SA2-12（MINOR，设计文档对 SA8 报告的计数/traceability） | **不在 SA3 ALLOW 范围**（`wiki/raw/task_issue-412_design.md` 为 SA1 产物、既不在 ALLOW 也不在 DENY）；未触碰 | 记录：留待 SA1/Controller 顺带修正（纯文本、零行为影响） |
| SA2-13（MINOR，hub-peer 停机句 memory 缺省预算括注） | 本轮写入的停机句已含「memory 配置无 schedule 键 → 缺省推导 `DEFAULT_MAX_DIRTY_MS + 边距`」 | 已落实（实质要求兑现） |

## SA8 约束落实

| 条款 | 落点 | 结果 |
| --- | --- | --- |
| D1 evolution-required（公开 drain 超出 :34 明文许可面） | ADR 0006 修订节（与代码同变更集）+ 第 3 条「与 :34 关系申明」（一次性、非协调器；宿主预算 = 「插件停止」映像） | 已落实 |
| D8 evolution-required（schedule 新键） | `PersistenceSchedule.retryDelayMs?` + DD-2 键形状不变裁决入 ADR 修订节第 5 条 | 已落实 |
| D19 evolution-required（两份集成文档宿主契约演进） | hub-peer-deployment 词表/停机序 + cordis-plugin-hosting :64/清单/示例 | 已落实 |
| O1/O2/O3（Owner ADR 义务） | ADR 修订节第 3/4 条（硬契约 + dispose 对齐）+ app 实现 + CONTEXT 词条 | 已落实 |
| D15（liveness 不变量） | `releaseSettleWaiters` + 四处移除点；ADR 修订节第 6 条收录不变量句 | 已落实（S-3 锚定 + mutation 反证） |
| action 1（修订与代码同变更集） | 同一未提交变更集（13 文件改 + 2 测试新增） | 已落实 |
| action 2（不得物化缺省 retryDelayMs 进 resolved schedule） | `resolvePersistenceSchedule` 条件展开；`persistence-contract.test.ts:32-37` 两键 `toEqual` 零改动即绿 | 已落实 |
| action 4（config 注释诚实） | config.ts `MAX_MAX_DIRTY_MS` 注释显式写「预算覆盖正常路径最坏等待；库级 drain 无上界；不得写成 drain 恒有界」 | 已落实 |
| action 5（实现后冲突复查） | 见文末 `requiresConflictRecheck` | 待 SA8 |

## File scope check

| Changed path | ALLOW entry | Purpose |
| --- | --- | --- |
| `packages/persistence/src/contract.ts` | ✅ 第 1 行 | 新类型/optional 成员/新配置键/解析条件展开 |
| `packages/persistence/src/lifecycle.ts` | ✅ 第 2 行 | drain 状态机 + retryBaseMs + 驱逐通知补全 + 字段注释 |
| `packages/persistence/src/memory.ts` | ✅ 第 3 行 | drain 委派 |
| `packages/persistence/src/file.ts` | ✅ 第 4 行 | drain 委派 + targets 校验 |
| `packages/persistence/src/index.ts` | ✅ 第 5 行 | barrel 导出新类型 |
| `packages/dsh-persistence/src/probe.ts` | ✅ 第 6 行 | 退避镜像锁步一行 |
| `apps/yjs-server/src/app.ts` | ✅ 第 7 行 | 停机第 3 步 + 句柄 + 助手 + 事件 + 注释 |
| `apps/yjs-server/src/config.ts` | ✅ 第 8 行 | 注释 + 拒绝文案 parenthetical（行为零变化） |
| `apps/yjs-server/src/main.ts` | ✅ 第 9 行 | 仅注释 |
| `docs/adr/0006-server-persistence-docstore.md` | ✅ 第 10 行 | 增量修订节 |
| `CONTEXT.md` | ✅ 第 11 行 | Language 新词条 |
| `docs/integration/hub-peer-deployment.md` | ✅ 第 12 行 | 词表 + 停机序 |
| `docs/integration/cordis-plugin-hosting.md` | ✅ 第 13 行 | 宿主硬契约指引 + 示例 |
| `packages/persistence/test/persistence-issue-412-drain-semantics.test.ts` | ✅ 第 14 行（S-1~S-4 建议新增） | 补充语义锚 |
| `apps/yjs-server/test/persistence-drain-shutdown.test.ts` | ✅ 第 15 行（S-5a/S-5b/S-5c 建议新增） | 端到端停机锚 |
| `domains/vfs3-assets/generated.ts`（**本轮修复**） | ⚠️ 不在设计 §11 ALLOW/DENY 两表内 —— **由本轮 dispatch 明示扩权**（「Diagnose and repair the failed `codegen-freshness` CI check for issue #412 with the smallest safe change」）+ `domains/AGENTS.md` §Workflow 2/3（生成物刷新为规定动作） | 生成物横幅刷新；`domains/**` 未被设计 DENY，`packages/vfsl-codegen/**`（生成器）零触碰 |
| `packages/vfsl/test/number-literals-fixture-drift.test.ts`（**本轮修复**） | ⚠️ 不在设计 §11 ALLOW/DENY 两表内 —— 同上 dispatch 扩权（重生成的**必然后果**：该哨兵钉死旧字节，不重钉则 `pnpm test` 必红，CI 仍不绿） | issue #314 SA6 字节哨兵重钉（值 1 行 + 注释 2 行；断言与语义指纹零改动） |
| `packages/vfsl/test/int-range-fixture-drift.test.ts`（**本轮修复**） | ⚠️ 同上（issue #315 SA6 字节哨兵） | 同值重钉（1 行 + 注释 2 行；断言与语义指纹零改动） |

DENY LIST 零触碰：`service.ts`、`testing.ts`、`namespace-registry/**`、dsh `record.ts/events.ts/profile.ts/cli.ts`、既有 persistence 测试（含冻结审计四组）、**SA6 两份契约文件**、`apps/yjs-server/test/` 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、Host/SA6/SA2/SA8 wiki 产物、`packages/vfsl-codegen/**`（本轮追加核对）。

## Verification

| Command | Result | Evidence |
| --- | --- | --- |
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck packages/persistence/test`（SA6 契约 + 既有 + 新增 S-1~S-4） | ✅ **21 files / 221 tests 全绿，Type Errors: no errors** | 契约文件由基线 `2 failed / 21 failed / 3 type errors` 转 **全绿**（`persistence-issue-412-drain-red.test.ts` 27 + `-surface.test-d.ts` 5 全过） |
| `npx tsc -p packages/persistence/tsconfig.json` | ✅ 零错误 | 基线 7 errors → 0 |
| `pnpm --filter`-等效：`vitest run --typecheck packages/persistence/test packages/dsh-persistence/test` | ✅ **24 files / 242 tests 全绿，no type errors** | DSH 探针 golden（`dsh-file-probe-determinism` 28 events 逐字节一致）零漂移 |
| `npx tsc -p apps/yjs-server/tsconfig.json` | ✅ 零错误 | 消费方类型面 |
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run apps/yjs-server/test` | ✅ **35 files / 182 tests 全绿，no type errors** | 含新增 S-5a/S-5b/S-5c；`ordered-shutdown-red`、`lifecycle-watchdog-red`、`issue270-regression-anchors`、`app-config-red` 保持绿 |
| `pnpm typecheck`（root 门，design §12 Runner 触发） | ✅ exit 0（**修复后复跑**） | 15 个 tsconfig 段全过 |
| `pnpm test`（root 门，design §12 Runner 触发 + persistence AGENTS；**修复后复跑**） | ✅ **435 files / 5242 tests 全绿（exit 0），Type Errors: no errors** —— 修复前同命令 = `2 failed / 5240 passed`（两处字节哨兵因重生成转红，已重钉） | 关键锚全绿：#412 契约 `persistence-issue-412-drain-red` 27 / `-surface` 5 / `-semantics` 9 / `apps/yjs-server/persistence-drain-shutdown` 3；`generate-union-member-docs` 33（含 `pnpm generate --check` 负控）；两处重钉哨兵 `number-literals` 3 / `int-range` 5 |
| `pnpm generate --check`（CI job `codegen-freshness` 步骤原文；**本轮修复目标**） | ✅ **exit 0**（修复前 exit 1：`生成物过期（diff 非空）：domains/vfs3-assets/generated.ts`） | 见「codegen-freshness CI 失败诊断与修复」节 |
| `npx vitest run packages/vfsl-codegen/test --typecheck --passWithNoTests=false` | ✅ 12 files / 119 tests，no type errors | 生成器语义零改动 |
| `npx vitest run packages/vfsl/test --typecheck --passWithNoTests=false` | ✅ 54 files / 1156 tests，no type errors | 含两处重钉字节哨兵 |
| `npx vitest run domains/vfs3-assets/test --typecheck --passWithNoTests=false` | ✅ 3 files / 31 tests，no type errors | 域投影类型面 + tsdoc |
| `pnpm exec vitest run packages/vfsl/test/domains-scaffold.test.ts --passWithNoTests=false`（CI `Domain scaffolds check` 步骤原文） | ✅ 2 tests | AC5/ADR 0005 |
| `npx tsc -p packages/vfsl/tsconfig.json`、`npx tsc -p packages/vfsl-codegen/tsconfig.json` | ✅ 0 错误 | 受影响两包类型面 |
| 本改动相关切片（persistence / dsh-persistence / yjs-server） | ✅ 全绿 | 三包逐条命令见上（24 files/242 tests + 35 files/182 tests） |
| Sensitivity mutation（反证，非交付物；用后恢复并 md5 校验） | ✅ 断言敏感 | ① 删除 `settleEntryForDelete` 驱逐通知 → S-3 双 adapter 超时红；② 恢复 `kind==='file'` 守卫 → S-5c 红（drain 0 次）；③ 恢复固定睡眠 → S-5a（withTimeout 红）/S-5b（无预算事件红）/S-5c 全红 |
| `git diff --check` | ✅ 无空白/冲突标记 | docs AGENTS 要求 |

## Deferred verification

- ~~**root `pnpm test` 的 2 个失败为既有问题**：`domains/vfs3-assets/generated.ts` 版本横幅过期（HEAD 发布提交遗留），与本 issue 零交集；不属 SA3 ALLOW，不修理。~~ **本轮 dispatch 已扩权关闭**：该失败 = 发布提交 `abbb89a` 的版本 bump 未伴随重生成；已按 `domains/AGENTS.md` §Workflow 重生成并同步重钉两处字节哨兵（见「codegen-freshness CI 失败诊断与修复」节）。修复后结果见 Verification 表。
- **`apps/yjs-server/AGENTS.md` 的单一拆卸链摘要行**（`registry shutdown → diagnostics close → persistence dispose → timer/clock teardown`）未列入设计 ALLOW，故未修改——该行不矛盾（drain 是同一链内的**等待**步，非第二条拆卸链），但未逐字反映新步骤；建议后续文档变更集补一行（记录为残余文档债）。
- **SA2-12**（设计文档对 SA8 报告计数/traceability 的修订）属 SA1 产物，不在 SA3 文件范围。
- 设计 §13 残余/follow-up 未变：DSH 记录头携带 `retryDelayMs` 的 golden 立法、yjs-server 配置面暴露 `retryDelayMs`、nomic-server 仓库外替换固定睡眠、archive×delete 既有理论挂起的专项系统性测试。
- 真正的外部消费者（nomic-server）行为与真实慢盘/生产停机时长画像：属 SA4/SA7 动态验证面，SA3 不扩展。

## Deviations or blockers

- **无阻塞、无设计偏离**。测试夹具参数相对设计示例的差异（均为等价实现选择，非语义变更）：
  1. S-5a/S-5b 使用 `schedule = { debounceMs: 5_000, maxDirtyMs: 5_000 }`（S-5a）与 `{ debounceMs: 1_000, maxDirtyMs: 20 }`（S-5b），而非设计的示例 `{ debounceMs: 10, maxDirtyMs: 20 }`——目的是把「落盘来自 step 3 强制完成式排空」与「首次 flush 不可能早于故障注入」变成**确定性**事实（定时器窗口 > stop 时长；首重试基准 = debounceMs 落在预算之外），消除 timing 竞争。设计明文允许机制等价替换（§12 S-5b「机制可换，任何确定性持续失败注入均可」）。
  2. S-5b 增加 `elapsedMs >= 500` 断言（预算确实被消耗 = drain 未提前返回）与 `tmpPath` 仍存在断言（写从未提交），强化「有损事实诚实」证据。
  3. `releaseSettleWaiters` 把 dispose 的内联通知抽为私有方法（单点不变量），行为与既有通知点 2 逐字节等价（`splice(0)` + 同步 call）。
- 未修改设计文件、未修改 #412 SA6 契约两文件、未 commit/push/建 PR、未调度其他 SA。
- **本轮（修复轮）偏离申报**：唯一实质取舍 = 重生成必然触发 issue #314/#315 两处字节哨兵，选择**重钉**而非回滚重生成（回滚会使 `codegen-freshness` 永久红）；重钉仅动 `GENERATED_SHA256` 常量值，两哨兵的语义指纹常量与断言零改动，且生成物 `Source hash` 未变可独立佐证语义中性。该取舍的权属依据 = 本轮 dispatch 明示要求修复 `codegen-freshness`（生成物与哨兵不在 #412 设计 ALLOW/DENY 两表内，属该设计未预见的仓库级漂移），是否需要 SA8/SA4 追加门禁由 Controller 裁定。

## Suggested commit message

**本轮修复（建议，未执行 commit）**：

```
fix(codegen): 重生成 vfs3-assets 投影并重钉字节哨兵——修复 codegen-freshness（issue #412 CI）

- domains/vfs3-assets/generated.ts：pnpm generate 全量重生成，唯一差异 = 生成器身份横幅
  @nomicore/vfsl-codegen@0.1.3 → 0.2.0（发布提交 abbb89a bump 版本时漏做；Source hash 与投影类型不变）
  ⟹ CI job codegen-freshness（pnpm generate --check）恢复 exit 0
- packages/vfsl/test/{number-literals,int-range}-fixture-drift.test.ts：重生成触发字节钉值哨兵
  （issue #314/#315 SA6 §4），同步重钉 GENERATED_SHA256 342d8c1f…e6707 → a934f62d…d65b；
  ENVELOPE/SEMANTIC 指纹与全部断言零改动（语义零漂移，哨兵对后续改写继续 fail loud）
- #412 主体实现与 SA6 契约（persistence/apps/docs）零触碰；#412 dispose 前 drain 硬契约与
  ADR 0006 对齐保持
- 验证：pnpm generate --check 0；vfsl-codegen 12 files/119 tests；vfsl 54 files/1156 tests；
  domain vfs3-assets 3 files/31 tests；root pnpm typecheck 0；root pnpm test 全绿
```

**上一轮（#412 主体，已由 Controller 提交为 `75bd0ab`）**：
```
feat(persistence): 公开完成式排空 drain + retryDelayMs 解耦 + 停机硬契约（issue #412）

- DocPersistence.drain?(targets?)：对所有 live 脏 entry（含有/零 handle）强制即时 flush
  （跳过 debounce）并 await settle；静息观察点结算、非破坏性、store 失败面永不 reject；
  PersistenceDrainTarget 经 barrel 导出；Memory/File 具体类方法（File 入口 validateIdentity）
- PersistenceSchedule.retryDelayMs?：重试首基准与 debounceMs 正交；键缺席时解析形状不变
  （lifecycle 内动态回退 debounceMs）；DSH 探针退避镜像锁步
- 排空通知面 liveness 完备化：任何移除 live entry 的路径必须释放 settle waiters
- apps/yjs-server：停机第 3 步固定睡眠 → file/memory 统一的有界完成式排空
  （awaitDrainWithBudget + persistence-drain-budget-exceeded 事件 + 有损继续）
- 规范同步：ADR 0006 修订节（drain 语义 + 停机硬契约 + dispose 对齐）、CONTEXT.md 词条、
  hub-peer-deployment 事件词表/停机序、cordis-plugin-hosting 宿主拆卸硬契约与示例
- 测试：SA6 契约 27+5 转绿；新增 S-1~S-4（persistence 语义）与 S-5a/S-5b/S-5c（停机链）
```
