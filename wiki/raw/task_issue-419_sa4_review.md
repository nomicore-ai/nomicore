# task_issue-419 SA4 实现静态审查 — 路由键契约 codec 守卫测试（spec #415 T1）

- Reviewed subject：SA3 交付 = 新文件 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（743 行，
  6 describe 组 / 19 用例）+ 5 份 `artifacts/sa3-issue419-*.log` 证据 + 报告 `wiki/raw/task_issue-419_sa3_impl.md`；
  **iteration 1 增量** = SA9 §3-F1 的证据完整性修复（恢复 `artifacts/sa6-issue419-runner-trigger.log`
  至 SA6 §17 登记字节）+ 新证据日志 `artifacts/sa3-issue419-f1-evidence-restore.log` + 报告原位更新
- Dispatch：`sa-5416f75e-36f7-4d90-b398-c16efddae1cb`（mabf-sa4，phase implementation-review，iteration 0）
  → 本轮 `sa-8aa10f21-58d9-4a04-81e2-27a93028ab0e`（mabf-sa4，phase implementation-review，**iteration 1**）
- Verdict：**approve**（无 BLOCKER / 无 MAJOR；8 条非阻断观察，见 §10/§11）
- 本轮为零修改静态审查：未修改任何被审对象、实现、设计、测试或证据；未运行测试/服务；唯一写入 = 本文件
  （iteration 0 新建 → 本轮原位更新）。Issue 评论 REST 快照 = **空（`[]`）**（dispatch 明示）——无 Owner
  评论要求、无评论 ID/时间戳可映射。
- **iteration 1 方法更正（采纳 SA9 §4-O3）**：iteration 0 §1 曾注明「未重算哈希、采信哈希链」——该采信点
  正是 SA9 F1 的暴露面。本轮对全部哈希断言**现场重算**（7 份 SA6 资产、守卫文件、F1 证据日志自哈希、
  工作树 vs HEAD 两版资产、悬挂 blob 内容、SA6 契约与 targeted-repeat.log 的入库一致性），不再采信任何链上值。

## 1. Reviewed inputs

| 输入 | 状态 | 本轮核验方式 |
|---|---|---|
| `wiki/raw/task_issue-419.md`（Host 简报） | 存在（已入库，工作树 == HEAD） | 全文亲读；AC1–AC5 +「纯增量测试，零行为变化」+ 空 Comments |
| `wiki/raw/task_issue-419_sa6_contract.md`（已批准契约） | 存在；**tracked 且入库**（`git ls-files` + `git show HEAD:…` sha256 `7c2a60be…` == 工作树，本轮重算） | §17 哈希注册表逐项现场重算比对（7/7，见 §3-F1 行）；§12.0/§12.6 契约面 iteration 0 已核，本轮未变 |
| `wiki/raw/task_issue-419_design.md`（SA1 设计） | 存在 | §11 ALLOW/DENY 原文复核（本轮亲读 L372–393）；§8 详案 iteration 0 已逐项核 |
| `wiki/raw/task_issue-419_sa2_review.md` | 存在 | approve；O1–O4 落实面 iteration 0 已核，交付未变 → 结论延续 |
| `wiki/raw/task_issue-419_design_conflict_report.md` / `…_implementation_conflict_report.md`（SA8 两道门） | 存在 | clear / requiresConflictRecheck=false（实现门 verdict 本轮复核：`implements-existing-decision` ×1 + `no-conflict` ×11） |
| `wiki/raw/task_issue-419_sa9_standards.md`（SA9 标准审查，**iteration 1 触发源**） | 存在（untracked 下游产物） | 全文亲读；reject 唯一阻断项 §3-F1（MAJOR）；§4-O1/O3 观察的闭合路径 |
| `wiki/raw/task_issue-419_sa10_spec.md`（SA10 spec 审查，iteration 0 终审） | 存在（untracked 下游产物，非 SA3 写入——其 dispatch `sa-b7b24437` 自述在案） | 头部与 Verdict 段亲读：approve（0 BLOCKER/MAJOR），且独立重算守卫 sha256 与本登记一致 |
| `artifacts/sa3-issue419-f1-evidence-restore.log`（**iteration 1 新证据**） | 存在（untracked，221 行/15421B） | 全文亲读；自哈希权威值现场重算 = `2932f2a7…`（与 SA3 报告登记一致）；内部一致性逐项独立复核（见 §3-F1 表） |
| `wiki/raw/task_issue-419_sa3_impl.md`（SA3 报告，iteration 1 原位更新） | 存在（` M`，+107/−4） | 全文亲读 + `git diff` 全量复核：iteration 0 结论未被改写，仅追加 §F1 返工/更正注记/iteration 1 验证表 |
| `artifacts/sa3-issue419-{package-suite,scope-and-tsc,mutation-rerun,guard-mutation-evidence,targeted-repeat}.log` | 存在（全部 tracked、工作树 == HEAD——`git status` 零条目） | iteration 0 已全文亲读；本轮复核 targeted-repeat.log 尾段的 22:55:44 完整性记录（sha `b19c0131…` 双侧一致） |
| `artifacts/sa6-issue419-*.log` ×5 + 探针/驱动 `.mts` ×2 | 存在 | **7/7 sha256 现场重算**，全部与 SA6 §17 登记一致（见 §3-F1 表） |
| 源码与测试 / Runner 与门禁基础设施 / 规范文本 | — | iteration 0 已逐锚点亲读；本轮 `git diff -- packages/replication-protocol/` 为空（交付零变更），结论延续 |
| Git 状态与对象库 | — | 本轮亲证：HEAD `02abf66`（committer/author 时间 `2026-09-21T23:05:33+08:00`）；变更集 = ` M` 资产（+1 行）+ ` M` SA3 报告 + `??` F1 证据日志 + `??` SA9/SA10 两份下游产物；`git diff --cached` 空；`.scratch/` 仅剩 tracked `vfsl-v1-parser`；`git fsck` 确认 blob `c183ba29…` unreachable |

## 2. Verdict

**approve**。

- **交付本体（iteration 0 已审）零变更**：守卫文件 sha256 `32aa83a5ffaa6a3c5499f7fbfc324e515d25e8b5b68fb2e2a503cf5d67e403d4`
  本轮现场重算与 SA3/SA4/SA9/SA10 四方登记一致；`src/`、fixtures、既有测试、文档、配置 live diff 全空。
  iteration 0 的设计落实 / 架构惯例 / 测试质量结论（§4–§5、§9）延续成立。
- **iteration 1 的 F1 修复经独立取证复核成立**：恢复字节与 SA6 §17 登记值 sha256 逐位相等（现场重算），
  `git hash-object` == 恢复源悬挂 blob `c183ba29…`（fsck 亲证存在且 unreachable，4322B，内容 sha256 == 登记值）；
  与 HEAD 已提交漂移版的差异经 `cmp -l` 定量 = **恰好 1 字节（文件尾空行 LF）**、共同 4321 字节零值差异 →
  全部 69 行内容逐字节相同，语义零变化。注册哈希链复原（当前工作树 7/7 资产与登记一致，全部现场重算）。
- **写 DENY 路径的授权链成立**：SA9 §3-F1 修复路径第 1 项「在能恢复原字节时恢复原状」+ 本轮 dispatch
  明示「Restore or otherwise resolve the evidence-integrity issue within authorized scope」；写回的是注册字节本身
  （消除既成 DENY 违反），非新修改。SA9「原始字节已不可恢复」的判断被对象库证据推翻（本轮独立复核该证据）。
- SA9 §4-O1 以书面说明闭合（"8.12" 文案在两版日志中均不存在——本轮 grep 复核 0/0，仅契约 L60/L73 命中 2）。
- 残留风险（提交后哈希终态复核、归一化器复发）已由 SA3 登记并正确路由 Controller/SA9（见 §11）。

无 BLOCKER / MAJOR finding。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1–AC5 +「纯增量测试，零行为变化」（Issue 正文） | iteration 0 已逐项核（本文件 §3 表延续有效）；交付文件本轮 sha256 复算一致、live diff 全空 | 落实（不变） |
| SA9 §3-F1（MAJOR）修复路径 1：恢复原字节 | 对象库悬挂 blob `c183ba29…`（4322B）→ `git cat-file blob` 逐字节写回；本轮现场重算：工作树 sha256 `96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c` == SA6 §17 契约 L274 登记值；`git hash-object` == `c183ba29…` == 恢复源 blob | **落实**（哈希链复原，本轮独立证明） |
| SA9 §3-F1「书面说明改动内容」要件 + §4-O1 闭合 | F1 证据日志 §7.1（字节级定量）/§7.2+§7.2a（mtime 取证，记为推断）/§7.3（O1 独立性：grep 0/0/2 本轮复核吻合）；报告 §F1-6 同步 | 落实（推断诚实标注为推断，未伪装成证明） |
| 本轮 dispatch：「Restore … within authorized scope / update the relevant evidence/report coherently, and provide verification / Preserve the approved semantic test delivery unless necessary / Do not broaden scope」 | 恢复动作 + 新证据日志 + 报告原位更新（三者连贯）；交付本体与全部语义验证保持（证据日志 §6 恢复后重跑记录：守卫 19/19、包全量 14 文件/233、TSC_EXIT=0——计数算术自洽 214+19=233）；变更集无任何范围外路径 | 落实（逐条对齐） |
| SA6 §17 注册完整性（7 份资产） | 本轮现场重算 7/7：`b340dcd3…`/`3631b43f…`/`b054b3c0…`/`c8f67f9b…`/`1f23a7a0…`/`1960c24a…`/`96abbb72…` 逐一与契约 L269–275 登记前缀相等 | 落实（注册链全绿） |
| SA9 §4-O3（对注册资产现场重算） | 本轮 SA4 全量现场重算（§1 方法更正）；SA3 报告 Deferred 表已登记为流程改进项 | 采纳（本文件即为执行） |
| 注册哈希的防篡改前提 | SA6 契约 tracked 且入库于 `02abf66`（工作树 == HEAD，本轮重算 `7c2a60be…`）；SA3 iteration 0 的 22:55:44 在盘哈希记录（targeted-repeat.log 尾段，tracked、工作树 == HEAD，sha `b19c0131…`）与登记全哈希相等 → 恢复字节 ≡ SA6 产出时在盘字节（SHA-256 抗碰撞） | 前提成立（恢复内容真确性不依赖任何单方陈述） |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §8.0–§8.8 守卫全案（G1–G6/NC1–NC3/走查器/登记块） | 交付文件（iteration 0 逐项核，见前版 §4 表） | 一致（交付零变更，本轮 sha256 复算锁死） | 无 |
| §11 ALLOW（单文件交付） | `packages/replication-protocol/test/codec-route-key-guard.test.ts` 唯一交付文件 | 一致 | 无 |
| §11 DENY「`artifacts/sa6-issue419-*.log` 只读」 | iteration 1 写 `artifacts/sa6-issue419-runner-trigger.log` 一项 | **受权例外**：SA9 fix path 1 + dispatch 授权；写回 = 注册字节（`git hash-object` == SA6 原 blob），消除既成违反而非扩大；其余 DENY 项零触碰（live 复核：diff 空 + 7/7 哈希 + 契约/简报/设计工作树 == HEAD） | 无（登记为偏差 4，处置正当） |
| §7.2 SD-1B（src 零改动） | `git diff -- packages/replication-protocol/` 空（本轮亲证） | 一致 | 无 |
| §7.5 SA6 证据笔误采信 | iteration 0 已核 | 一致（不变） | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 证据资产恢复 | 发现违规的实现方（SA3），在 SA9 裁定的修复路径内 | SA3 iteration 1 | 正确（SA9 fix path 1 明示；未越权改 SA6 契约/注册表） |
| 哈希重登记（仅当恢复失败/复发时） | SA6/Controller | 未发生（不需要） | 正确（SA3 未代办 SA6 职权） |
| 提交与提交后终态复核 | Controller | SA3 已登记 R1 + 提交消息模板内嵌复核指令 | 正确（SA3 无 commit 职权） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 取证恢复（对象库悬挂 blob） | git 原生能力（`cat-file`/`fsck`），仓库先例 sa3-issue337/388 系列仅用日志取证，无 blob 恢复先例 | `git cat-file blob` 写回 + 尺寸窗扫描 | 一致（只用 git 原生只读取证 + 单次字节写回，无脚本资产入库） | 一次性修复动作，非可复用抽象，不产生平行机制 |
| 证据日志惯例 | `artifacts/sa3-issue*.log` 系列先例 | `sa3-issue419-f1-evidence-restore.log`（§ 编号 + 命令 + 输出 + 结论行） | 一致 | 同款取证日志形态 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| SA6 资产注册哈希 | SA6 契约 §17（tracked、入库） | 各评审的现场重算 | 低：本轮起全量现场重算；提交后终态复核已登记（§11-R1） |
| 恢复字节真确性 | SHA-256(工作树字节) == 注册值（密码学等式） | 证据日志叙事（恢复源/唯一性/mtime 推断） | 无（叙事仅辅助；等式独立成立，见 §3-F1 表） |

### 生命周期对称性 / 平行机制检查

无运行时生命周期（纯字节写回 + 日志）。无平行机制：未引入第二注册表、第二恢复工具或常驻脚本；
`/tmp` 派生副本（orig/committed 两份，日志 §10 披露）为一次性 diff 基准，未入库、未注册，不构成第二事实源
（权威 = 对象库 blob + 注册哈希）。

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 设计 §11 ALLOW 唯一行（iteration 0 新建） | AC1–AC4 守卫本体 | 在范围内；iteration 1 零触碰（sha256 复算一致） |
| `artifacts/sa3-issue419-*.log` ×5（iteration 0） | DENY 未覆盖（DENY 仅钉 `sa6-issue419-*`） | 门禁原始证据 | 合规；全部 tracked、工作树 == HEAD |
| `artifacts/sa6-issue419-runner-trigger.log`（**iteration 1**） | DENY 钉只读；本轮 = SA9 fix path 1 + dispatch 授权的**恢复写** | 复原注册哈希链 | **受权例外，合规**：+1 行（尾空行 LF）；写后 sha256 == 登记值、`git hash-object` == `c183ba29…`（SA6 原 blob）——消除既成违反；范围论证在报告 §F1「范围正当性」，本轮独立证据支持 |
| `artifacts/sa3-issue419-f1-evidence-restore.log`（**iteration 1**） | DENY 未覆盖（`sa6-issue419-*` glob 不匹配 `sa3-*`；iteration 0 已确立 sa3-* 证据日志惯例） | F1 修复取证/验证原始证据 | 合规；自哈希权威值本轮复算一致（`2932f2a7…`，221 行/15421B） |
| `wiki/raw/task_issue-419_sa3_impl.md` | 技能固定产物（非 DENY 既有输入——iteration 0 起 SA8/SA9/SA10 均按此解释接受） | 实现报告原位更新 | 合规；diff 复核 = 纯追加 iteration 1 内容 + 一处「iteration 1 更正」诚实注记，无历史改写 |
| `wiki/raw/task_issue-419_sa9_standards.md` / `…_sa10_spec.md`（untracked） | 非 SA3 产物 | 下游评审自有产物 | 不计入 SA3 范围（SA10 文档自述其 dispatch；SA3 报告明示未触碰；与本轮变更集边界清晰） |

DENY 逐项复核（本轮 live 亲证）：`src/**`（diff 空）、`fixtures.ts` 与既有 13 测试（零 modification）、
协议文档/ADR 0032/CONTEXT/`ws-replication/**`/`vitest.config.ts`/`package.json`/`tsconfig*.json`（零改动）、
SA6 契约/设计/简报（工作树 == HEAD）、探针/驱动 + 其余 4 份 SA6 日志（哈希 == 登记）。
唯一 DENY 写 = 受权恢复项，如上。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| SA6 §17 注册哈希的消费者（SA9/SA10/Controller 终审） | 全部以注册表为验真基准 | 工作树已复原；**HEAD 仍是漂移字节（`23787bf1…`）直至 Controller 提交本修复**——SA3 报告/证据日志/提交消息模板三处内嵌提交后复核指令（`git show HEAD:… \| sha256sum` == `96abbb72…`） | 低（已登记 R1，路由正确；见 §11） | 无 |
| 归一化器复发（finalization 阶段重写 EOF） | 未知工具（mtime 取证：提交秒内同批重写资产+简报两路径，形状同为 EOF 归一化；简报 mtime `23:05:33.003385853` 本轮仍亲证在盘） | 复发时 fallback = SA6/Controller 重登记（SA9 fix path 2，DENY 路径、SA6 职权）——SA3 已登记，未越权代办 | 中低（取决于 Controller 侧工具行为，静态不可判） | 无（入 §11 动态验证项） |
| vitest/tsc 发现面与 CI 入口 | 根 `pnpm test` / `pnpm typecheck` | iteration 0 已核（include/typecheck script 覆盖新文件）；本轮交付零变更；恢复的资产不在 vitest include glob 内、不影响套件 | 无 | 无 |
| codec 公开 API 消费者 | 全仓 | 零 src 改动（live diff 空） | 无 | 无 |

## 8. 错误、恢复与并发

- **恢复动作确定性**：`git cat-file blob` 单次字节写回（无编辑器/格式化器中间层）；本轮对结果做三方独立
  复算（sha256 / git hash-object / wc）全部与声明一致。
- **无静默失败**：恢复后立即重验（哈希 + 门禁重跑，证据日志 §3/§6）；失败会直接暴露为哈希不等。
- **诚实证据处理**：证据日志内嵌自哈希因 tee 缓冲产生两个陈旧值（§11 `78d243ec…`/§11b `397f0134…`），
  未被隐藏——§11c 明示陈旧并以报告登记的终态值（`2932f2a7…`）为权威，本轮复算证实该值正确。
- **根因表述纪律**：归一化器归属记为「推断（非证明）」，未指认无证据的工具/角色；SA9「不可恢复」判断的
  推翻以对象库 blob 实证支撑（本轮独立复核 blob 存在、unreachable、4322B、内容哈希 == 注册值）。
- **并发/TOCTOU**：修复期间无其他写入面（变更集恰为申报集）；恢复后未再触碰（资产 mtime `23:19:46` ==
  证据日志声明，此后零变动）。
- 静态无法确认的项：见 §11（归一化器是否在后续 finalization 复发；全仓门禁 3）。

## 9. 测试质量审查

- **交付本体测试面零变化**：守卫文件 sha256 复算一致 → iteration 0 §9 全表（19 用例/6 组、断言纪律
  独立 grep、⊇ 探针映射、变异双证据、CI 触发性）延续成立；SA9 §2「测试质量：合规」同证。
- **iteration 1 补充验证（不运测，核日志内部一致性）**：证据日志 §6 恢复后重跑——守卫 19 passed /
  包全量 14 文件 / 233 passed / Type Errors no errors / `GUARD_EXIT=0` / `PACKAGE_SUITE_EXIT=0` /
  `TSC_EXIT=0`；计数算术自洽（基线 214 + 守卫 19 = 233），文件清单与 iteration 0 package-suite.log
  同集；恢复对象是 artifacts 日志（不在 vitest include glob `packages/*/test/**/*.test.ts` 内），
  重跑属超义务的一致性确认而非弱化替代。
- **无 skip/only/todo、无源码字符串断言**：iteration 0 独立 grep 结论 + 交付零变更 → 延续。

## 10. Required revisions

无（无 BLOCKER / 无 MAJOR finding）。SA9 §3-F1 已按其 fix path 1 落实并经本轮独立取证复核闭合；
SA9 §4-O1 随书面说明闭合；SA9 §4-O3 已被本轮方法更正采纳。

## 11. Non-blocking observations

- **O1（G1-b 超设计字面的加强，iteration 0 登记）**：不变，接受（见前版表述）。
- **O2（根级门禁 3 延后 SA7/CI）**：不变；SA10 §5 亦列为 PR 必须披露项，收口时补跑即可。
- **O3（守卫级变异驱动未持久化）**：不变，可接受（正式 RK-C6 门禁由仓内 SA6 驱动承载）。
- **O4（G4-b 下界措辞）**：不变，纯措辞级。
- **O5（iteration 1，证据日志组织）**：`sa3-issue419-f1-evidence-restore.log` 的 §7.2a/§10a/§11b/§11c
  为事后补记、编号乱序（§7.2a 在 §8 之后、§10a 在 §11 之后）；内嵌自哈希两值为 tee 缓冲陈旧值。已诚实
  披露且权威值（报告登记 + 本轮复算）正确——组织性问题，不影响证据效力。后续同类日志建议一次成文或
  以附录统一补记。
- **O6（iteration 1，「恢复源唯一性」论证略超证据）**：日志 §10 的 grep 仅覆盖 `/tmp`、本 worktree 的
  `.scratch/` 与 `artifacts/`；其余 5 个 worktree 仅 `git worktree list` 列出、未做内容扫描，报告却表述为
  「其余 worktree / scratch / tmp 均无该资产的独立副本」。该表述超出 grep 实测面。**对修复正确性零影响**
  （恢复真确性由「内容 sha256 == 注册值」密码学等式独立成立，与副本是否存在无关），仅叙事精度问题。
- **O7（iteration 1，`/tmp` 派生副本残留）**：`/tmp/orig-runner-trigger.log`（4322B）/`/tmp/committed-runner-trigger.log`
  （4321B）修复后仍在（本轮 stat 亲证）。已在日志 §10 披露、未入库不污染仓库；属会话级临时物，不构成
  完整性风险（内容 = 注册字节 / 已入库漂移字节的副本）。
- **O8（iteration 1，恢复源的持久性）**：悬挂 blob `c183ba29…` 现存于 23:24–23:25 生成的 pack（修复后某次
  repack/gc 所致；unreachable 但按默认 prune 窗口保留）。在 Controller 提交本修复前它是唯一「对象库内」恢复源；
  提交后即转为 reachable。工作树副本已是活保障，故仅提示：**尽快提交本修复**（与 R1 同一并入下表）。

## 12. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| **R1：提交后哈希终态**（HEAD 现仍为漂移字节 `23787bf1…`，修复尚未入库） | Controller（提交本修复后） | `git show HEAD:artifacts/sa6-issue419-runner-trigger.log \| sha256sum` = `96abbb72ecefdc3ad2b37bc8cfcdbb011e7c43b409c0b5f130c7a3e7a1b2e06c`；同时 ` M` 条目消失 | 值 ≠ `96abbb72…`（归一化器在 finalization 复发）→ 转 SA6/Controller 重登记（SA9 fix path 2） |
| 归一化器复发面（资产 + 简报曾在提交秒内同批被重写） | Controller/SA9 对本次提交的全部路径做 mtime/哈希抽查 | 仅申报的修复路径变更；简报等其余路径字节不变 | 再现未申报的同批 EOF 归一化 → 查 finalization 工具链 |
| 全仓回归（根级门禁 3） | SA7/CI 跑根 `pnpm test` 与 `pnpm typecheck` | 两命令 exit 0 | 任何包因新文件引入失败（静态未发现路径） |
| 守卫长期变异敏感性复跑 | 复跑 SA6 变异驱动（两轮） | `MUTATION_RESULT 6/6 expected`，exit 0 | 任意变异不再点亮对应探针检查 |
| 注册表 append-only 演进 | 未来新增 namespace-scope 消息型/错误码 | NC2/NC3/G2 计数响亮红 = 有意识契约修订信号（头注已写明处置） | 新型静默落入旧计数 |

---

审查方法与限制：本轮为零修改静态审查（亲读全部 SA 产物/证据日志/设计契约 + git 状态/对象库只读取证
+ sha256/git-hash-object/cmp/fsck/mtime 现场重算 + 只读 grep），未运行任何测试、未启动服务、未创建临时
进程或文件；未修改任何被审对象（唯一写入 = 本文件原位更新）。iteration 0 曾「采信哈希链」，本轮起全部
哈希断言现场重算（SA9 §4-O3 采纳）。`approve` 不替代 SA7 对活链路/全仓门禁的最终验证，亦不预支
Controller 的提交后终态复核（§12-R1）。
