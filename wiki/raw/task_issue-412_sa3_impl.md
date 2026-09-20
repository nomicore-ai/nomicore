# SA3 Implementation Report

- 任务：issue #412（persistence：公开完成式排空 `drain()` + `retryDelayMs` 与 `debounceMs` 解耦 + 宿主优雅停机 `drain` 硬契约）
- Worktree：`/home/wangjian/nomicore-fix-issue-412`（分支 `mabf/issue-412`）
- 当前 HEAD：`5b3ff26 docs(mabf): record CI repair final reviews`（`9094760 fix(codegen): refresh generated vfs3 assets` ← `75bd0ab feat(persistence): add completion drain lifecycle`）
- 本轮 dispatch：`sa-8d39566b-0cce-467a-87a0-5f9bc0c879ce`（phase implementation，**iteration 2**）——修复失败的 CI 检查（test matrix `test (20, 4)` / `test (24, 4)` + `codegen-freshness`），以 TDD 与最小安全改动为纪律；保持 Owner comment `5751613018`（updated `2026-09-20T18:03:36Z`，MEMBER）：drain-before-dispose 硬契约 + ADR-0006 对齐；`retryDelayMs` 独立可配置且缺省行为兼容
- **本轮结论：无需新增产品代码改动。** 具名的三个 CI 检查在当前 HEAD 上**全部转绿**（CI run `35534499992`，conclusion `success`）；三者的**唯一根因**（发布提交 `abbb89a` 把 `@nomicore/vfsl-codegen` 0.1.3→0.2.0 却未同步重生成 `domains/vfs3-assets/generated.ts`）已由 iteration 1 的修复提交 `9094760` + `5b3ff26` 落地。本轮以 CI 原文命令与相关契约重跑完成验证（证据见 §Verification），不引入任何额外变更——任何新改动都会构成超出 dispatch 的 scope creep。

## Inputs consumed

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-412.md` | 已读 | Issue 正文（缺口 1/2、消费方证据、请求面） |
| `wiki/raw/task_issue-412_design.md`（iteration 2，SA2 verdict **approve**） | 已读（§11 ALLOW/DENY 两表、§12 验收映射、§8 状态机骨架） | 实施唯一依据 + 本轮范围核对 |
| `wiki/raw/task_issue-412_sa6_contract.md` | 已读 | 契约项 C1–C14、runner 触发命令、S-1~S-5 缺口 |
| `wiki/raw/task_issue-412_sa2_review.md` | 已读（§13/§14 修订映射） | SA2-1~SA2-13 落实核对（0 BLOCKER/0 MAJOR） |
| `wiki/raw/task_issue-412_design_conflict_report.md`、`..._implementation_conflict_report.md` | 已读 | SA8 约束（ADR 同变更集、不得物化缺省 retryDelayMs、注释诚实性、liveness 不变量）；实现后复审 **clear**、requiresConflictRecheck **false** |
| `wiki/raw/task_issue-412_sa4_review.md`、`..._sa9_standards.md`、`..._sa10_spec.md` | 已读 | iteration 0/1 审查结论（approve ×3）；本轮核对审查对象 = HEAD 提交态，未被本轮触碰 |
| `.github/workflows/ci.yml`（`test` 矩阵 :50-80、`codegen-freshness` :124-147） | 已读 | 本轮修复目标三个检查的步骤原文（`pnpm generate --check`、`node scripts/ci-test-shard.mjs 4 6` + vitest） |
| `scripts/ci-test-shard.mjs`、`.github/ci/test-durations.json` | 已读 | 分片 4 文件列表来源（LPT 装箱，磁盘枚举决定） |
| `domains/AGENTS.md` §Workflow、`packages/vfsl-codegen/AGENTS.md`、`packages/vfsl/AGENTS.md`、`packages/vfsl-codegen/src/header.ts` | 已读 | 生成物刷新规定动作、生成器版本横幅自同步机制、验证门 |
| GitHub Actions API（`gh run view` / `--log`） | 只读拉取 | 失败 run `35532235822`（head `75bd0ab`）失败步骤原文 + 当前 run `35534499992`（head `5b3ff26`）逐 job 结论 |

## Existing worktree reconciliation

- 本轮入口工作区**干净**（`git status --short` 无产品改动），HEAD = `5b3ff26` = PR #413 `headRefOid`；`git diff HEAD --stat` 为空。
- iteration 1 的实现与修复（#412 主体 13 文件 + 2 新测试；codegen 修复 3 文件）**均已提交并逐字节在位**；本轮**零触碰**全部实现、测试与文档路径。
- SA6 两份契约文件（`persistence-issue-412-drain-red.test.ts`、`persistence-issue-412-drain-surface.test-d.ts`）与两份 SA6 契约文件外的验收锚（`persistence-issue-412-drain-semantics.test.ts`、`apps/yjs-server/test/persistence-drain-shutdown.test.ts`）本轮 md5 复核/重跑，零改动。
- 本轮新增产物仅为**证据日志**（`artifacts/sa3-issue412-iter2-*.log`，5 份）与本报告的原位更新；`artifacts/*.log` 属仓内既有 SA3 证据惯例（`git ls-files artifacts/` = 207 项）。

## Changed paths

**本轮（iteration 2）：无产品代码/测试/文档改动。**

| Path | Design section | Change |
| --- | --- | --- |
| `wiki/raw/task_issue-412_sa3_impl.md` | 本报告（SA3 产物原位更新） | 更新为当前实现 + 当前验证结果（iteration 2 核验轮） |
| `artifacts/sa3-issue412-iter2-generate-check.log` | CI `codegen-freshness` 步骤原文复跑 | 证据 |
| `artifacts/sa3-issue412-iter2-shard4-node24.log` | CI test 分片命令原文复跑（Node 24.13.0） | 证据 |
| `artifacts/sa3-issue412-iter2-persistence-contract.log` | SA6 §12 runner 触发（persistence 切片） | 证据 |
| `artifacts/sa3-issue412-iter2-shutdown-tests.log` | §12 S-5 停机锚 | 证据 |
| `artifacts/sa3-issue412-iter2-root-typecheck.log` | root `pnpm typecheck`（设计 §12） | 证据 |

**已在 HEAD 提交的实现与修复（iteration 0/1 产物，本轮核对在位、零改动）**：

| Path | Design section | Change（已提交） |
| --- | --- | --- |
| `packages/persistence/src/contract.ts` | DD-1~DD-5 | `PersistenceDrainTarget`；`DocPersistence.drain?` optional + 语义 doc-comment；`PersistenceSchedule.retryDelayMs?`；`resolvePersistenceSchedule` 条件展开 |
| `packages/persistence/src/lifecycle.ts` | DD-2/DD-5/DD-5b | 公共 `drain(targets?)`；`retryBaseMs` 单源 getter；`releaseSettleWaiters` 统一释放 + 四处移除点 |
| `packages/persistence/src/memory.ts` / `file.ts` / `index.ts` | DD-1 | drain 委派（File 入口 `validateIdentity`）；barrel 导出新类型 |
| `packages/dsh-persistence/src/probe.ts` | DD-6 | 退避镜像锁步 `retryDelayMs ?? debounceMs` |
| `apps/yjs-server/src/app.ts` / `config.ts` / `main.ts` | DD-7 | 停机第 3 步固定睡眠 → file/memory 统一的 `awaitDrainWithBudget` + `persistence-drain-budget-exceeded` 事件 + 有损继续；注释/文案刷新 |
| `docs/adr/0006-server-persistence-docstore.md`、`CONTEXT.md`、`docs/integration/*.md` | DD-8 | 修订节 7 条（含 :270 无条件硬契约、:276 修订并扩展 :86）；词条；宿主指引 |
| `packages/persistence/test/persistence-issue-412-drain-semantics.test.ts`（新）、`apps/yjs-server/test/persistence-drain-shutdown.test.ts`（新） | §12 S-1~S-5 | 9 + 3 tests |
| `domains/vfs3-assets/generated.ts` + `packages/vfsl/test/{number-literals,int-range}-fixture-drift.test.ts` | iteration 1 修复（dispatch 扩权 + `domains/AGENTS.md` §Workflow） | 生成物横幅 `0.1.3→0.2.0`（恰 1 行）；两字节哨兵 `GENERATED_SHA256` 同值重钉 + 原因注释（断言/语义指纹零改动） |

## 本轮 CI 失败诊断与现状（三个具名检查 = 同一根因）

### 失败态：run `35532235822`（head `75bd0ab`，即修复提交之前）

| Job | 结果 | 失败原文（`gh run view --log`，只读拉取） |
| --- | --- | --- |
| `codegen-freshness`（ID 106134762854） | ✗ exit 1 | `vfsl-codegen: --check 失败 — 生成物过期（diff 非空）：/home/runner/work/nomicore/nomicore/domains/vfs3-assets/generated.ts`（步骤 = `pnpm generate --check`，ci.yml:147） |
| `test (20, 4)`（ID 106134763028） | ✗ | 分片 4 内 `packages/vfsl-codegen/test/generate-union-member-docs.test.ts` 2 失败：①逐字节负控 `Expected Generator: @nomicore/vfsl-codegen@0.1.3 / Received …@0.2.0`；②spawn `pnpm generate --check` 期待 0 实得 1 |
| `test (24, 4)`（ID 106134763051） | ✗ | 同 shard 4 同一负控（Node 20/24 双红） |

根因（iteration 1 已独立复核，本轮 CI 日志再次证实）：`header.ts` 按设计在生成时运行时读取 `packages/vfsl-codegen/package.json` 的 `version` 写入横幅；发布提交 `abbb89a` 把版本 0.1.3→0.2.0（`git show` 核对）却未同变更集重生成——仓内生成物自 `2fdac1b` 起未刷新，`--check`（全量重生成 → 逐字节 diff）自此恒红。**与 #412 变更集零交集**（`75bd0ab` 未触碰 `domains/**`、`packages/vfsl*/**`），是仓库级历史遗留。

### 现状（修复后）：run `35534499992`（head `5b3ff26` = 当前 HEAD，PR #413 `headRefOid`）

- **run conclusion = `success`**；三个具名检查逐一转绿：

| Job | 结果 | 证据 |
| --- | --- | --- |
| `codegen-freshness`（106140967802） | ✓ 13s | `pnpm generate --check` 无 diff 输出、无 `##[error]` |
| `test (20, 4)`（106140967967） | ✓ 2m4s | `Test Files 65 passed (65)`，无 `##[error]` |
| `test (24, 4)`（106140968040） | ✓ 2m9s | `Test Files 65 passed (65)` |
| 其余 job（typecheck / contract-gates / packaging / 其余 9 分片） | 全部 ✓ | run conclusion success |

- 修复通道 = `domains/AGENTS.md` §Workflow 规定动作（`pnpm generate` 重生成，非手改生成文本、非削弱门禁）；生成物唯一差异 = 生成器身份横幅一行，`Source hash: sha256:82e98fa1…b93c69` 与投影类型逐字节不变 ⟹ 语义中性；备选（钉死/移除横幅）会削弱 ADR 0005 §4 生成器漂移警报，已被否决。
- 重生成必然触发 issue #314/#315 两处字节哨兵（其 doc-comment 自述「重新生成即此处先红」），iteration 1 已按既定工作流重钉 `GENERATED_SHA256`（`342d8c1f…e6707` → `a934f62d…d65b`），语义指纹常量与全部断言零改动。

## Owner comment 5751613018 硬契约保持性（本轮零触碰核对）

| Owner 要求 | HEAD 证据 | 判定 |
| --- | --- | --- |
| 宿主优雅停机**必须先 `await drain()` 再 dispose**（硬契约，非建议） | `docs/adr/0006-server-persistence-docstore.md:270` 无条件条款（明文引用 comment 5751613018，含「预算尽后继续 dispose 是可观察退出、不是违约」）；`apps/yjs-server/src/app.ts` 停机链 `awaitDrainWithBudget(adapter.drain(), budgetMs)` 结构性先于全仓唯一 `persistenceFiber.dispose()`；file/memory 统一无 kind 特判 | **保持**（commit `9094760`/`5b3ff26` 对 `packages/persistence/**`、`apps/yjs-server/**`、`docs/adr/**` diff 为空） |
| 同步修订 ADR-0006 :86 dispose 定义 | ADR 0006:276「本节**修订并扩展** :86 的 dispose 定义边界」——dispose 保持 abortive/有损、从不是持久性屏障、分层公开 drain 为唯一持久性表达 | **保持** |
| dispose 保持 abortive 时保留分层公开 drain | `packages/persistence/src/contract.ts` `readonly drain?:` optional 成员；`lifecycle.ts` `async drain`；SA6 契约 27 运行期 + 5 类型面锚在本轮重跑中全绿 | **保持** |
| `retryDelayMs` 独立可配置、缺省保持现行为 | `PersistenceSchedule.retryDelayMs?` + 缺省动态回退 `debounceMs`（解析键形状不变，既有冻结审计零改动即绿） | **保持** |

## SA2 Finding落实（iteration 1，均已随 HEAD 提交）

| Finding ID | Implementation | Result |
| --- | --- | --- |
| **SA2-1（MAJOR，预算组合）** | `app.ts` `awaitDrainWithBudget`（race + timer 早清）+ 预算 = `maxDirtyMs + 边距` + 预算尽 `persistence-drain-budget-exceeded` + 有损继续 | 已落实（S-5b 实测；mutation 反证：恢复固定睡眠 → S-5a/S-5b/S-5c 全红） |
| SA2-2（静息观察点措辞） | `contract.ts` doc-comment + ADR 修订节第 2 条 | 已落实 |
| SA2-3（永不 reject vs File 校验） | 显式例外通道申明 + File 入口 `validateIdentity` | 已落实（S-4 File 专项） |
| SA2-4 / SA2-5 / SA2-8 / SA2-9 / SA2-10 / SA2-13 | 字段注释、CONTEXT `_Avoid_`、词表条件性注记、示例 drain 步、「修订并扩展」措辞、memory 缺省预算括注 | 已落实（文本逐条在位） |
| SA2-6（契约文件零触碰） | 两份 SA6 文件本轮重跑时 md5/内容零改动 | 已落实 |
| **SA2-7（MAJOR，memory 统一）** | 停机第 3 步删除 `kind==='file'` 守卫；plugin 句柄两分支统一 | 已落实（S-5c 实测；mutation 反证 → 红） |
| SA2-11 / SA2-12 | 实现层证据（S-5b）/ 设计文档文本属 SA1 产物、不在 SA3 ALLOW | 记录（SA2-12 留 SA1/Controller） |

## SA8 约束落实（iteration 1，均已随 HEAD 提交）

| 条款 | 落点 | 结果 |
| --- | --- | --- |
| D1/D8/D19 evolution-required | ADR 0006 修订节（同变更集）+ `PersistenceSchedule.retryDelayMs?` 键形状裁决 + 两份集成文档宿主契约演进 | 已落实 |
| O1/O2/O3（Owner ADR 义务） | ADR 修订节第 3/4 条 + app 实现 + CONTEXT 词条 | 已落实 |
| D15（liveness 不变量） | `releaseSettleWaiters` + 四处移除点；ADR 修订节第 6 条 | 已落实 |
| action 2（不得物化缺省 retryDelayMs） | `resolvePersistenceSchedule` 条件展开；`persistence-contract.test.ts` 冻结审计零改动即绿 | 已落实 |
| action 4（config 注释诚实） | `MAX_MAX_DIRTY_MS` 注释显式写「库级 drain 无上界」 | 已落实 |
| action 5（实现后冲突复查） | SA8 实现后复审 **clear** / requiresConflictRecheck **false** | 已闭合 |

## File scope check

| Changed path（本轮） | ALLOW entry | Purpose |
| --- | --- | --- |
| `wiki/raw/task_issue-412_sa3_impl.md` | SA3 固定产物（skill §实现报告） | 原位更新为当前实现/当前验证 |
| `artifacts/sa3-issue412-iter2-*.log`（5） | 仓内 SA3 证据惯例（`artifacts/` 既有 207 项 tracked） | 验证证据留档 |

- **本轮零产品代码改动**，因此不存在越出设计 §11 ALLOW 的新面；iteration 1 的扩权面（`domains/vfs3-assets/generated.ts` + 两字节哨兵，不在设计 §11 两表内、由 dispatch 明示修复指令 + `domains/AGENTS.md` §Workflow 授权）已由 SA8 R12 记录为「范围申报事项，交 Controller 认定」，并在 SA9 O1/SA10 §8-1 登记为 PR 披露项。
- DENY LIST 本轮与 iteration 1 均零触碰：`service.ts`、`testing.ts`、`namespace-registry/**`、dsh `record.ts/events.ts/profile.ts/cli.ts`、既有 persistence 测试（含冻结审计）、**SA6 两份契约文件**、apps 既有测试、`docs/protocols/**`、`packages/ws-replication/**`、Host/SA6/SA2/SA8 wiki 产物、`packages/vfsl-codegen/**`、`.github/**`、`domains/vfs3-assets/schema.vfsl`。

## Verification（本轮，iteration 2）

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm generate --check`（CI job `codegen-freshness` 步骤原文） | ✅ **exit 0** | `artifacts/sa3-issue412-iter2-generate-check.log`；CI run `35534499992` 同 job ✓ 13s |
| `files=$(node scripts/ci-test-shard.mjs 4 6); NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run $files --typecheck.enabled=false --passWithNoTests=false`（CI `test (…, 4)` 步骤原文，本机 Node v24.13.0） | ✅ **65 files / 767 tests 全绿，exit 0**（含此前红的 `generate-union-member-docs.test.ts` 33 tests、`persistence-issue-412-drain-semantics.test.ts` 9 tests） | `artifacts/sa3-issue412-iter2-shard4-node24.log` |
| CI `test (20, 4)`（Node 20，权威环境） | ✅ 2m4s，`Test Files 65 passed (65)` | CI run `35534499992` job 106140967967（本地无 Node 20，以 CI 为权威证据） |
| CI `test (24, 4)`（Node 24，权威环境） | ✅ 2m9s，`Test Files 65 passed (65)` | CI run `35534499992` job 106140968040 |
| CI run `35534499992` 整体 | ✅ **conclusion `success`**，全部 16 job 绿（typecheck / contract-gates / packaging / 12 分片） | `gh run view 35534499992 --json status,conclusion,headSha` → headSha = `5b3ff26` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/persistence/test`（SA6 §12 runner 触发） | ✅ **21 files / 221 tests 全绿，Type Errors: no errors，exit 0**（含 `persistence-issue-412-drain-red.test.ts` 27 + `-surface.test-d.ts` 5） | `artifacts/sa3-issue412-iter2-persistence-contract.log` |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck apps/yjs-server/test/persistence-drain-shutdown.test.ts`（S-5a/S-5b/S-5c） | ✅ **3 tests 全绿，exit 0** | `artifacts/sa3-issue412-iter2-shutdown-tests.log` |
| `pnpm typecheck`（root 门，设计 §12） | ✅ exit 0（15 个 tsconfig 段） | `artifacts/sa3-issue412-iter2-root-typecheck.log` |
| `git diff HEAD --stat` / `git status --short` | ✅ 产品树零 diff，仅 5 份未跟踪证据日志 | 出口核对 |

## Deferred verification

- **Node 20 本地不可用**（本机仅 v24.13.0 / v25.6.0）：Node 20 面以 CI run `35534499992` 的 `test (20, 4)` 与 `typecheck`（node 20）实测为权威证据，本轮不做本机替身。
- 真正的外部消费者（nomic-server）行为、真实慢盘/生产停机时长画像：属 SA4/SA7 动态验证面，SA3 不扩展。
- 设计 §13 残余/follow-up 不变：DSH 记录头携带 `retryDelayMs` 的 golden 立法、yjs-server 配置面暴露 `retryDelayMs`、nomic-server 仓库外替换固定睡眠、archive×delete 既有理论挂起的专项系统性测试。
- `apps/yjs-server/AGENTS.md` 的单一拆卸链摘要行未逐字反映新增等待步（不矛盾，drain 是同一链内的等待步）——仍为残余文档债，建议后续文档变更集补一行。
- 流程性（SA9 N-1 / SA10 O4）：后续凡 bump `@nomicore/vfsl-codegen` 版本的发布变更集应同集执行 `pnpm generate`，避免重造本次这类「`--check` 恒红」态；属发布流程建议，非本 issue 变更集内容。

## Deviations or blockers

- **无阻塞、无设计偏离、本轮无代码变更**。
- 本轮唯一判定：dispatch 所述三个失败检查的根因同一且已由 HEAD 修复并在 CI 中转为 `success`；TDD 纪律体现为「以 CI 原文命令与 SA6 契约重跑确认绿」，而非制造无必要的改动。若 Controller 掌握更新于 run `35534499992` 的失败观测，请回传具体 job/日志以便定位（当前 HEAD 与 PR #413 的 CI 均为绿）。
- 若需要将本次修复的 PR 披露项带上（范围扩权、跨任务哨兵重钉、根因归属），沿用 SA10 §8 清单，本轮无新增披露项。

## Suggested commit message

**本轮（iteration 2）**：无产品代码改动，无需提交；如需留档，可仅提交证据与本报告：

```
docs(mabf): issue #412 iteration 2 验证留档——三个具名 CI 检查已在 HEAD 全绿

- codegen-freshness / test (20,4) / test (24,4)：CI run 35534499992（head 5b3ff26）
  conclusion success；三者唯一根因（abbb89a 版本 bump 未重生成）已由 9094760 修复
- 本机复跑：pnpm generate --check exit 0；shard 4 步骤 65 files/767 tests 绿；
  persistence 契约 21 files/221 tests 绿（SA6 27+5）；S-5 停机锚 3 tests 绿；root typecheck 0
- Owner comment 5751613018：drain-before-dispose 硬契约 + ADR-0006 对齐零触碰
```

**iteration 1（已由 Controller 提交，此处留档）**：`9094760 fix(codegen): refresh generated vfs3 assets`（生成物横幅刷新 + 两字节哨兵重钉）；`75bd0ab feat(persistence): add completion drain lifecycle`（#412 主体实现）。
