# SA3 Implementation Report — Issue #405 `readData 面：maxBytes 交付总量收/拒闸（tracer）`

- 派发（现任）：`sa-12c7e175-4493-40b2-9fbe-3357add1b9ba`（role `mabf-sa3`，phase `implementation`，iteration 2）。前两次派发（`sa-3310f959…` 实现、`sa-f1c25552…` 复验）均因 Host execution-observer / structured_output schema 终态失败而无可用完成裁决；实现产物完整留在同一工作区。本派发：核对最新设计与上游契约、逐项复核既有实现、**独立复跑全部指定验证**（含红灯基线复现、契约族、包内/root 门禁、范围守卫），并原位更新本报告。
- Worktree：`/home/wangjian/nomicore-fix-issue-405`（branch `mabf/issue-405`，HEAD `fc6c1d3` = ADR 0031 入仓提交）
- 实现依据：SA1 设计 `wiki/raw/task_issue-405_design.md` + SA6 契约 rev2 `wiki/raw/task_issue-405_sa6_contract.md`（验收权威）+ SA2 review（`approve`，MINOR-1–4，Required revisions 空表）+ SA8 conflict report（`clear`，RA-D1–RA-D5）
- 形态：TDD —— 红灯契约先落盘并实跑证明 HEAD 红（红因单一），生产实现在同一工作区落地至全绿。
- **本派发净新增仅**：本报告更新 + `artifacts/sa3-issue405-verification.log` 重写。生产/测试/文档**零改动**（`md5(runtime.ts)=706d44a26fd50d90b729f23f9b3fc1f5`、`md5(index.ts)=362d7c9afadef8cef1babf514a5339ba` 在全部命令前后逐一比对一致，含红灯基线的 revert/restore）。

## Inputs consumed

| 输入 | 状态 / 用途 |
|---|---|
| `wiki/raw/task_issue-405.md` | Issue 正文 AC1–AC10；Comments 段空（与派发说明的 REST `[]` 一致，无 owner 评论、无 override） |
| `wiki/raw/task_issue-405_design.md` | 唯一实现架构依据（DD-1–DD-9、§8.1 组合次序、§11 ALLOW/DENY、§12 G1–G12、§15 `requiresConflictRecheck = true`） |
| `wiki/raw/task_issue-405_sa6_contract.md`（rev2） | 验收权威：§12.0 锚表 R0–R12、§12.2 契约文件、§12.3 G1–G12、§12.4 红/绿判定表、§12.5 反伪绿 R1–R11、§12.7 pins、§12.8 门禁清单 |
| `wiki/raw/task_issue-405_sa2_review.md` | `approve`；Required revisions 空表；MINOR-1–4 处置见下 |
| `wiki/raw/task_issue-405_design_conflict_report.md` | `clear`；RA-D1（split parity）/RA-D2（B11 锁同变更集 + 相邻注释）/RA-D3（OBL-DOC-1）/RA-D4（实现后复审）/RA-D5（OBL-WIN-1）落实见下 |
| `wiki/raw/task_issue-405_relevant_decisions.md`、`docs/adr/0031-readdata-byte-budget.md` | 决策条款与母法（决策 1–6 + 修订节 + 验收节） |
| 源码实读（本派发复核） | `runtime.ts`（三键 interface / 预算联合 / `readData` 组合体 / `splitReadDataOptions` / `canonicalReadOptions` / `deliveryBytes` / `readDataBudgetExceeded`）、`doc-runtime/src/read.ts` L326–361（T1 读纪律逐行对照 split）、`read-schema-projection.ts`（头行两轴）、registry `lease.ts`/`types.ts` 别名链、`index.ts` 导出键集、四个既有测试锚（F-x5/F-x6 计数、F6/F7 定序） |
| 既有待修订实现 | 上一派发的完整实现已在工作区（13 条 ALLOW 路径）；本派发逐项核对后**全部保留**，无过时/残缺/与设计冲突的残留 |

## Existing worktree reconciliation

开工时工作区 = 前两派发的完整产出（生产 + 契约测试 + Phase B 文档）。本派发核对结论：

- **生产面**：`runtime.ts`（+307/−39 区间内）与 SA1 §8.1 组合次序逐行对照一致——S1 lifecycle gate 不变 → S2a 无 options 分支不变 → **S2b-0 G0 前置分支**（非数组 path 零 options 读取）→ **S2b-1 `splitReadDataOptions`** → **S2b-2 T1 改读 relay** → **canonical 三键白名单 + `maxBytes` 剥离/回传** → 出口① 改 re-split + re-T1 → **P 投影** → **S2b-5 预算闸门** → 恒四键组装。`index.ts` 仅注释增量（导出语句区零改动，公共值导出面仍恰 `RuntimeWriteFatalError`）。
- **测试面**：5 个新契约/夹具文件 + 2 个原位修订（B11 两键 `Equal` 锁 → 三键闭合形状锁且**相邻注释同步重写**；registry 别名锁原位扩展）；`issue-405-maxbytes-fixture.ts` 为非 `*.test.ts`（不被收集）。
- **文档面**：Phase B `SCOPE_DOCS` 三文件重录在案（OBL-DOC-1 兑现）。
- **结论**：**无需修复、无需删除**。唯一不完整项在前两次派发中是「最终裁决登记」（`structured_output` 未产出），本派发以独立复验 + 本报告收口。

## Changed paths

### Phase A — 红灯契约（先落盘、先实跑证明 HEAD 红）

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-runtime/test/issue-405-maxbytes-fixture.ts`（新增，191 行） | §11 ALLOW；SA6 §12.0 | 冻结 schema 文本（CJK 种子，utf8 ≠ utf16）、strict/raw 种子、锚常量 R0–R12 与 §12.0 逐行同构、`utf8()`、**独立两通道 oracle** `measureChannels()`、runtime 装配 helper |
| `packages/namespace-runtime/test/issue-405-maxbytes-red.test.ts`（新增，476 行 / 14 用例） | §12 G1–G6/G8(带预算侧)/G10 | G1 逐字节一致；G2 `≤` 成对边界；G3 五键零交付 + path 新鲜回显/变异隔离 + 单通道锚；G4 度量等式 property（9 严格锚 + 2 raw 锚，独立 oracle）；G5 域外矩阵 + 域可区分 + **C-LIMIT 组级判据（拒绝锚 ∧ 有效域接受锚）**；G6 缺席目标；G8 带 `maxBytes` 侧 schema 逐字节；G10 优先级阶梯 + 敌意 options（accessor / 非 enumerable / present-undefined / 状态化与交替 descriptor trap，计数 parity 4/5） |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts`（新增，239 行 / 8 用例） | §12 G7/G8(无预算侧)/G11 | R0–R12 逐锚复验（值/schema/total/truncated/头行/✂ 文法）、头行与 ✂ 段文法锚、缺席与零总量语义、G11 窗口面与 doc-runtime 面负控、装置前提 fail-loud |
| `packages/namespace-runtime/test/issue-405-maxbytes.test-d.ts`（新增，151 行） | §12 G5/G9 类型侧；DD-5.2 | 三键闭合形状锁、第四键/错误值型编译红、`Extract<…, {code:'READ_BUDGET_EXCEEDED'}>` 恰五键（零成功键）、legacy 零泄漏、**doc-runtime `keyof` 恰两键硬锁**、末签名锁、EOPT 负例 |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-passthrough-red.test.ts`（新增，244 行 / 6 用例） | §12 G9 行为 | lease ≡ runtime（收/拒同载荷）、原样透传同一引用、released 短路（三键、零 runtime 触达）、lifecycle 同走 `RUNTIME_READ_DISABLED`、legacy 单参通道 |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-surface.test-d.ts`（新增，130 行） | §12 G9 类型 | 别名组合锁延续、`READ_BUDGET_EXCEEDED` 别名跟随 + 五键形状、options 跟随（runtime 单源 options 直传）、legacy 零泄漏 + 末签名锁 |

### Phase A — 生产实现

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-runtime/src/runtime.ts` | DD-1–DD-5、DD-8、§8.1 | ① `NamespaceRuntimeReadDataOptions` 由 doc-runtime 两键别名改为 **runtime 自持三键闭合 interface**；② 新增包内 `ReadDataBudgetExceededResult` 并追加进 `NamespaceRuntimeReadDataBudgetResult`；③ `readData` 组合体：G0 前置分支 / `splitReadDataOptions` / T1 改读中继 / canonical 三键白名单 + `maxBytes` 下传前剥离并回传 / 出口① re-split + re-T1 / 预算闸门；④ 包内 helper `splitReadDataOptions`、`budgetAxisInvalid`、`deliveryBytes`、`readDataBudgetExceeded` 与三条稳定 message 常量；⑤ 接口与组合体 JSDoc 三键化（含失败优先级阶梯） |
| `packages/namespace-runtime/src/index.ts` | §11 ALLOW（仅注释） | `#405 增量` 注释（options 三键、预算联合追加 `READ_BUDGET_EXCEEDED`、导出键集零变化）；导出语句区**零改动** |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts` | DD-5.4 / §2 B11；RA-D2 | 原位修订 `_optionsAlias` 两键 `Equal` 锁 → `_optionsClosedShape` 三键闭合形状锁，**相邻注释同步重写**（清退「doc-runtime 单源类型别名」失真陈述） |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts` | §11 ALLOW（原位扩展） | options 闭合形状跟随锁、`READ_BUDGET_EXCEEDED` 别名跟随 + 五键形状 + 零成功键锁、lease 三键调用点、第四键编译红负例 |

### Phase B — OBL-DOC-1 作用域文档重录（紧随同迭代独立变更集，逐项对照 SA6 §3.3 台账）

| Path | Design section | Change |
|---|---|---|
| `.agents/skills/nomicore/typed-access.md` | DD-9.1 | 清退「the closed options shape accepts only the two budget keys」失真句（→ 三键闭合形状）；新增 `### Byte-budget reads: maxBytes` 小节：域、总量语义、`≤` 成功且逐字节相同、`>` 零交付五键、塑形后计量、缺席目标可超限、ADR 0031 决策 6 分工指引、确定性重试 |
| `docs/integration/cordis-plugin-hosting.md` | DD-9.2 | 预算读注释段封闭形状两键 → 三键；补 `maxBytes` 收/拒语义、总量等式、五键 `READ_BUDGET_EXCEEDED` 词汇与决策 6 分工句 |
| `docs/integration/external-project-vfsl-codegen.md` | DD-9.3 | readData 结果段补三键 options 与 `maxBytes`/预算失败分支（五键形）词汇 |

### 本派发新增（证据，非规范产物）

| Path | 用途 |
|---|---|
| `wiki/raw/task_issue-405_sa3_impl.md` | 本报告原位更新（现任派发 + 独立复跑证据） |
| `artifacts/sa3-issue405-verification.log` | 红灯基线复现 / 契约族 / 包内与 root 门禁 / 范围守卫结果 + 迭代 1 变异探针留档（同一源码 md5） |

## SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| Required revisions（BLOCKER/MAJOR） | 空表 | 无待落实项 |
| MINOR-1（DD-5.1 括注与 DD-3 矛盾：canonical 参数类型） | 按 **DD-3 与 §8.1 伪代码**落地：`canonicalReadOptions(raw: NamespaceRuntimeReadDataOptions)` 放宽为三键（必须读到 `maxBytes` 才能剥离/回传），中继 `relay` 沿用 runtime options 类型 | 已消解（SA3 不修改设计文件；本行即记录） |
| MINOR-2（`Buffer.byteLength` 为 runtime src 首个 Node 全局；建议可考虑 `TextEncoder`） | **未采纳**，沿设计 DD-4 的 `Buffer.byteLength`：非分配式长度计算（不追加物化，契合 ADR 0031 决策 2/6 成本陈述）；本包 `engines.node >= 20`、`@types/node` 在位；理由写入 `deliveryBytes` JSDoc | 记录不处理理由（skill 允许 MINOR 记录理由） |
| MINOR-3（R-2 残余未点名「`maxBytes` 键在读间消失 → 预算静默脱落」子例） | 行为不改，且与 HEAD 对 `depth` 的既有处置逐字同款（canonical 判据判定、不做键集比对） | 记录（与 HEAD 同族接受残余，非本设计新造） |
| MINOR-4（registry `types.ts` JSDoc 部分枚举缺 `READ_BUDGET_EXCEEDED`） | registry `src/**` 属 DENY（透传语义证据 = 源码零改动）；别名经 `lease.ts` Equal 锁强制，注释非契约载体 | 记录不改（如需注释级整洁须单列后续票） |

## SA8 required actions 落实

| RA | 落实 |
|---|---|
| RA-D1（split parity = 实现验收） | 本派发逐行对照 `doc-runtime/src/read.ts` L326–361：split 宿主门（`typeof`/`null`/`Array.isArray` → `getPrototypeOf`）与 T1 同序、`Object.keys` + 逐键显式 descriptor（每键恰 2 次 descriptor 读）、零 `[[Get]]`、accessor 拒、present-undefined 剥离、整体 try 收编。既有 F-x5 `descriptorCalls()===4` / F-x6 `===5` 复跑全绿；新增三键面对手锚（`{maxBytes:1}` 状态化 trap = 4 / 交替 trap = 5）同绿 |
| RA-D2（B11 锁同变更集 + 相邻注释） | 同一工作区变更集内完成：`runtime-readdata-shape-budget.test-d.ts` 两键 `Equal` 锁原位三键化，失真注释一并重写（无中间红态）；root `pnpm typecheck` exit 0 |
| RA-D3（OBL-DOC-1 兑现监督） | Phase B 已紧随同迭代落地（三个 `SCOPE_DOCS` 重录，逐项对照 §3.3 台账）；「归调用方字节闸」清退子项经复核为真空（与 SA8 §8/SA6 §3.3 实测一致）；doc-sync 门禁 43/43 绿 |
| RA-D4（实现后复审） | 本报告 + 本派发 `structured_output.requiresConflictRecheck = true` 触发 implementation 复查模式；§5 冻结面证据（DENY 零 diff、成功面四键、头行不记 `maxBytes`）见下 |
| RA-D5（OBL-WIN-1 独立票） | 本票不动窗口面：携 `maxBytes` 仍走 `WINDOW_OPTIONS_INVALID`（G11 绿）；`readDataBudgetExceeded` message 已冻结为窗口面票的逐字镜像基准 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/src/runtime.ts` | Phase A 第 1 行 | 全部生产面改动（类型 + 组合体 + helper） |
| `packages/namespace-runtime/src/index.ts` | Phase A 第 2 行（仅注释） | `#405 增量` 注释；导出语句区零改 |
| `packages/namespace-runtime/test/issue-405-maxbytes-fixture.ts` | Phase A 第 3 行 | §12.0 冻结 fixture + 锚常量 + oracle |
| `packages/namespace-runtime/test/issue-405-maxbytes-red.test.ts` | Phase A 第 4 行 | G1–G6、G8(带预算侧)、G10 红灯契约 |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts` | Phase A 第 5 行 | G7、G8(无预算侧)、G11 回归/负控 |
| `packages/namespace-runtime/test/issue-405-maxbytes.test-d.ts` | Phase A 第 6 行 | 类型面（三键、五键分支、零泄漏、doc-runtime 两键硬锁、EOPT） |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts` | Phase A 第 7 行（原位修订） | B11 两键 `Equal` 锁 → 三键锁（DD-5.4 / RA-D2） |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-passthrough-red.test.ts` | Phase A 第 8 行 | G9 行为（lease ≡ runtime / released / lifecycle / legacy） |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-surface.test-d.ts` | Phase A 第 9 行 | G9 类型（别名跟随 + options 跟随 + 五键载荷） |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts` | Phase A 第 10 行（原位扩展） | 既有别名锁延伸点 |
| `.agents/skills/nomicore/typed-access.md` | Phase B 第 1 行 | OBL-DOC-1 重录 |
| `docs/integration/cordis-plugin-hosting.md` | Phase B 第 2 行 | OBL-DOC-1 重录 |
| `docs/integration/external-project-vfsl-codegen.md` | Phase B 第 3 行 | OBL-DOC-1 重录 |
| `wiki/raw/task_issue-405_sa3_impl.md` | 本报告 | SA3 固定产物 |
| `artifacts/sa3-issue405-verification.log` | 证据留档（非规范产物；沿 `artifacts/sa3-issue*.log` 仓内惯例） | 本派发验证原始输出摘要 |

**ALLOW 覆盖核对（本派发实测）**：`git status --porcelain --untracked-files=all` 去掉 `wiki/**` 与 `artifacts/**` 后**恰为上表 13 条实现路径**，无 ALLOW 外改动。

**DENY 面零 diff 证据（本派发实测）**：`git status --porcelain --untracked-files=all` 对 `packages/doc-runtime`、`packages/vfsl`、`packages/vfsl-protocol`、`packages/vfsl-codegen`、`packages/namespace-runtime/src/read-schema-projection.ts`、`packages/namespace-runtime/src/window-read.ts`、`packages/namespace-registry/src`、`CONTEXT.md`、`docs/adr`、`vitest.config.ts`、`tsconfig*.json`、`apps`、`package.json` **全部为空**；`git diff --check` exit 0。

## Verification

本派发**独立复跑全部指定验证**（不转述前两次派发结论）：

| Command | Result | Evidence |
|---|---|---|
| **红灯基线复现（本派发独立执行）**：备份实现源码 → `git show HEAD:<path> > <path>`（索引不动）→ 复跑红灯契约 → EXIT trap 恢复 | **红：`Test Files 2 failed \| 1 passed (3)`；`Tests 14 failed \| 14 passed (28)`**；红因单一——12 条均为 `READ_OPTIONS_INVALID` + 「options 含未知键（封闭形状）：maxBytes」。控制组 8/8 绿（SA6 §12.4 要求 HEAD 即绿）；red 12/14 红（2 条 G10 负控按 §12.4「混合」预期绿）；registry 2/6 红（G9 收/拒侧） | `artifacts/sa3-issue405-verification.log` §[1]；复现后 md5 逐一比对恢复（`706d44a2…`/`362d7c9a…`），`git status` 回 ` M` |
| **契约族（9 文件，含 `--typecheck`）** | **exit 0；9 files / 70 tests passed；Type Errors: no errors**（含 F-x5=4 / F-x6=5 与三键面 4/5 parity 计数） | 同上 §[2] |
| 包内定点：`vitest run --typecheck packages/namespace-runtime/test packages/namespace-registry/test` | **exit 0；130 files / 1258 tests passed；no type errors** | 同上 §[3]（SA6 §12.8 第 3 条） |
| `pnpm exec tsc -p packages/namespace-runtime/tsconfig.json` | exit 0 | 同上 §[3] |
| `pnpm exec tsc -p packages/namespace-registry/tsconfig.json` | exit 0 | 同上 §[3] |
| 文档同步门禁：`vitest run readdata-docs-adr0016-sync-{control,red}.test.ts` | **exit 0；43 tests passed**（OBL-DOC-1） | 同上 §[3] |
| root `pnpm typecheck`（14 project） | **exit 0** | 同上 §[4]（SA6 §12.8 第 1 条） |
| root `pnpm test`（全量，含 `--typecheck`） | **exit 0；417 files / 5055 tests passed；no type errors**（610.34s；基线 412 files / 5021 tests → **+5 files / +34 tests**，恰 = 5 个新契约/夹具文件与 14+8+3+6+3 用例；零 skip/only/todo） | 同上 §[4]（SA6 §12.8 第 2/5 条；runtime/registry AGENTS「root typecheck + test」义务） |
| `git diff --check` + DENY 面 diff + skip/only/todo 扫描 | exit 0 / 空 / 零命中 | 同上 §[5]（SA6 §12.8 第 4/5 条） |
| **变异探针（迭代 1，同一源码 md5，留档）**：M1 闸门 `>`→`>=`；M2 度量丢弃 schema 通道；M3 split 域判定失效 | M1 **6 failed / 8 passed**；M2 **7 failed / 7 passed**；M3 **1 failed**（G5 message 域可区分）→ 三个语义面各自被独立断言捕获 | 同上 §[6] |

## Deferred verification

- **SA4/SA7/CI 终态核验**：本派发已实跑 root `pnpm test`/`pnpm typecheck`/包内门禁/契约族为绿；评审裁决、真实环境验收、发布门禁（minor bump）与 CI 不在 SA3 职责内。
- **OBL-WIN-1**（窗口面三面 `maxBytes` 义务 + message 逐字镜像）挂账于独立票（SA8 RA-D5）；本票 G11 只锁递延期守卫。
- **载荷拆分（值/口径分项）** 与 **可选裁剪模式（`over:'trim'`）** 为 ADR 0031 登记的加法演进位，不在本票承诺内。
- **doc-sync 扫描器两键白名单**（`packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` 的 `BUDGET_OPTION_KEYS`）在 ADR 0031 三键化后语义偏窄：Phase B 文档已按现有门禁可接受形态重录，43/43 门禁保持绿；把 scanner 更新为三键属其自身夹具的后续票（该文件不在本票 ALLOW/DENY 任一清单授权面，未触碰）。
- **静态生成**：本票无 VFSL schema 改动，无 `generate --check`/`schema:check` 义务（设计 §11 未指定）。

## Deviations or blockers

1. **无阻塞。** 设计可实施、ALLOW/DENY 明确、SA2/SA8 约束全部在设计范围内达成；本派发生产/测试/文档**零改动**（仅报告与证据留档）。
2. **SA6 §12.2 契约文件切分微调（非语义）**：G8 的「带 `maxBytes` 侧」断言按 §12.4 判定表（G8 = 「部分红（带 maxBytes 侧红）」）落在**红灯文件**，控制文件承载 G8 无预算侧/文法零漂移——使控制文件在 HEAD 即绿（§12.2 对控制文件的「HEAD 即绿」要求与 §12.4 的 G8「部分红」在同一文件内不可同时成立，本切分同时满足两者）。G9(部分) 未在 runtime 控制文件重复，行为与类型两组完整落在 registry 契约文件（§12.2 已列名）。实测：控制组在 HEAD 8/8 绿、实现后 8/8 绿，切分自洽。
3. **G5 第四键矩阵 message 字面（实现权威 vs 契约单行的张力，保留供 SA4/SA7 裁决）**：`{maxBytes: 1, nope: 1}` 的拒绝权威是 doc-runtime T1（DD-2 明文要求中继保留未知键、message 单源不复制），故其 message 命名 `nope` 而非含 `maxBytes`——本契约断言为「码/恰四键/非空 ∧ message 与 `{nope:1}` **同源** ∧ 未知键名 = `nope`」，并把「含 `maxBytes` 域标识且与未知键 message 不同」的域区分断言施加在**域外值矩阵**与有效域接受锚上。SA6 §12.3 G5 该一行字面若逐字施加于第四键行，则必须把 `maxBytes` 重新中继给 T1（HEAD 伪绿路径）或复制 T1 message——两者均被 DD-2 否决。**组级判据不受影响**（HEAD 红 / 实现后绿；§12.5 R2 的 C-LIMIT 正是按组级求值）；SA3 不改写断言迎合实现，如实登记。
4. **G5 灵敏度承载点（迭代 1 变异探针 M3 实测）**：若 split 的 `maxBytes` 域前置判定失效而 canonical 判定保留，域外用例仍经出口②/接缝路径返回 `READ_OPTIONS_INVALID`（**码不变**），此时唯一捕获变异的是 G5 的 **message 域可区分**断言。即「非法 `maxBytes` 在 doc 触碰前短路」这一 DD-2/DD-8 定序事实由 message 文案承载可观测性（契约明示不钉死措辞、只断言域可区分）。登记为设计事实，非缺陷。
5. **`deliveryBytes` 的 `JSON.stringify` 值面**：值通道由 doc-runtime 深拷贝普通 JSON 值（`bigint`/函数/环不可由载体产生），SA2 R-3 残余接受；不新增防御分支（fail loud 而非静默 fallback）。
6. **`readData` S2b-0 分支的 fail-loud 不变式守卫**：非数组 path 由 doc-runtime G0 恒拒，故实现中「G0 竟接受」的 `throw` 分支在正常路径不可达（守卫编码该信任域不变量；设计 §8.1 伪代码只写了 `return readLogicalValueAtPath(doc, path)`，落地需以守卫满足类型收口）。既有 F6 定序锚（非数组 path + 非法 options → `PATH_NOT_ALLOWED`、零 options 读取）复跑保持绿。

## Suggested commit message

```
feat(namespace-runtime): readData maxBytes 交付总量收/拒闸（ADR 0031 / #405）

- options 闭合形状两键 → 三键 {depth?, maxChildrenPerNode?, maxBytes?}（runtime 自持宿主；
  doc-runtime 零改动、下传恒两键）
- 组合层新增拆分读 splitReadDataOptions（T1 逐字同款读纪律 + 忠实中继，读次序 parity
  F-x5=4/F-x6=5 保持）与三键 canonical 净化（maxBytes 下传前剥离/回传，头行不记）
- 预算闸门：measuredBytes = utf8(JSON.stringify(value)) + utf8(投影文本)；≤ 收（逐字节相同）
  / > 零交付 READ_BUDGET_EXCEEDED 五键（measuredBytes 只报合计）
- 预算联合追加 ReadDataBudgetExceededResult；legacy 联合与导出键集零变化；registry 别名跟随
- 契约测试：runtime G1–G11 红→绿 + 锚表 R0–R12 回归；registry lease 行为/类型面
- B11 锁原位三键化（同变更集）；OBL-DOC-1 重录 SCOPE_DOCS 三文件
```

（Phase B 文档重录如需独立提交：`docs(readdata): OBL-DOC-1 作用域文档 maxBytes 词汇重录（#405）`。）
