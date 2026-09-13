# SA3 Implementation Report — Issue #337 `[shape-budget] T4: DeepOptional 预算读类型面`

- 派发：`sa-6abf01e3-a262-44fe-b5a2-c1c7d8e04582`（role `mabf-sa3`，phase `implementation`，iteration 1 —— **重试派发**）
- Worktree：`/home/wangjian/nomicore-fix-issue-337`（branch `mabf/issue-337`，基线 HEAD `cb8aaff0297a802432ba7532a407c65218852dce`）
- 结论：**实现完成、红灯在本会话重新捕获、规定门禁全绿，无 deviation、无 blocker**。
- 重试上下文：上次 SA3（`sa-1aafcfc0-5f87-40d5-a860-82470a65c4d0`，iteration 0）已把实现与红/绿证据落盘，但以 observer/schema 失败告终、无业务 verdict。按技能「已有实现报告或未提交实现 = 当前待修订状态」纪律，本次**原位复核**：逐文件核对实现与设计/契约一致 → 保留符合设计的改动 → 在本会话重新执行 TDD 红灯捕获（临时把两源文件回退到 HEAD → 复红 → 逐字节恢复，sha256 校验）→ 重跑全部规定门禁与变异敏感性 → 原位更新本报告，使其只描述当前实现与当前验证结果。
- Implemented surface（三项，与设计字面一致）：`@nomicore/vfsl-protocol` 第 13 名纯类型导出 `DeepOptional`（递归可选值域映射）、`PROTOCOL_EXPORT_NAMES` 同变更集跟名、`VfslTypedAccess<Map>.readBudgeted` 预算读类型接缝。

---

## 1. Inputs consumed

| 输入 | 路径 | 用法 |
|---|---|---|
| 任务简报 | `wiki/raw/task_issue-337.md` | Issue #337 正文 AC1–AC4；Comments 为空（派发说明：REST 刷新为空，无 Owner 要求） |
| SA1 设计（唯一设计产物） | `wiki/raw/task_issue-337_design.md` | §7 D-1（`DeepOptional` 精确形态 + 三分支表示）、D-2（落点 = `VfslTypedAccess.readBudgeted`）、D-3（无 options 零 diff）、D-4（名单跟名）、D-5（断言判据）、D-6（判别字段退路不启用）、D-7（fail-closed）、§11 ALLOW/DENY、§12.2 断言规格、§12.3 门禁与变异矩阵 |
| SA2 设计评审 | `wiki/raw/task_issue-337_sa2_review.md` | verdict `approve`（无 BLOCKER/MAJOR）；§14 N1–N5 非阻断观察 |
| SA6 验收契约 | `wiki/raw/task_issue-337_sa6_contract.md` | §12.2 G1/G3/G4 断言组、§12.3 测试文件清单、§12.4 红灯机制、§12.5 变异矩阵、§12.6 验证门 |
| SA8 前置门禁 | `wiki/raw/task_issue-337_conflict_report.md` | verdict `clear`；§8 行动 1–4；§10 `requiresConflictRecheck=true` |
| SA8 设计后复审 | `wiki/raw/task_issue-337_design_conflict_report.md` | verdict `clear`；实现期核对清单 |
| 决议摘录 | `wiki/raw/task_issue-337_relevant_decisions.md` | ADR 条款行号摘录（ADR-0024 决策 7、ADR-0004 D2–D5 等） |
| SA6 证据 | `artifacts/sa6-issue337-{export-surface,type-probes,runner-probe,guard-sensitivity,baseline-gates}.log` | 基线指纹与红灯机制判据 |
| 源码锚 | `packages/vfsl-protocol/src/index.ts`、`packages/vfsl-codegen/src/protocol-surface.ts`、`packages/doc-runtime/src/read.ts` L74–77（options 单源）、`packages/vfsl-codegen/src/{index,emitter}.ts`、`packages/vfsl-codegen/test/{generate-alias-collision-guard.test.ts,tsc-helper.ts}`、既有 test-d ×4 | 落点、oracle 与守卫机制 |
| 模块契约 | `packages/vfsl-protocol/AGENTS.md`、`packages/vfsl-codegen/AGENTS.md`、根 `AGENTS.md` | 纯类型空模块、公共兼容契约、负例 test-d、导出面变更跑 root 门、`generate --check` |

无阻塞性缺失：ALLOW/DENY 明确、红灯契约与设计一致、接口与失败语义足以编码。

## 2. Existing worktree reconciliation

到达时状态（`git status --short`）：

- 生产改动 2 处（未提交，符合设计）：`packages/vfsl-protocol/src/index.ts`（+51/−1）、`packages/vfsl-codegen/src/protocol-surface.ts`（+4/−1）。
- 新增测试 2 个（未跟踪）：`vfsl-protocol-deep-optional.test-d.ts`（175 行 / 19 tests）、`vfsl-protocol-budget-access.test-d.ts`（233 行 / 20 tests）。
- 上次 SA3 的实现报告与 9 个证据日志已在位。

逐项复核结论（保留全部符合设计的改动，未发现过时/冲突/不完整实现）：

| 复核项 | 判据 | 结论 |
|---|---|---|
| `DeepOptional` 形态 = 设计 §7 D-1 字面 | 变长数组同态映射不加 `?` / 元组元素可选 / 对象全字段可选 / 标量原样；`PathValue` 之后、`PathKind` 之前；doc-comment 含记法桥接 | 逐字一致，保留 |
| `readBudgeted` 签名 = 设计 §7 D-2 | `read` 之后、`kindOf` 之前；`const P` + 内联封闭 options + `...rest: FailClosedRest<Map, P>`；返回 `DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>` | 逐字一致，保留 |
| 名单跟名 = 设计 §7 D-4 | `PROTOCOL_EXPORT_NAMES` 含 `'DeepOptional'`（13 名）；头注如实追加 T4 注记且 2026-08-21 基点描述原地保留 | 一致，保留 |
| 测试锚 = SA6 §12.2 G1/G3/G4 | 文件 1（G1.1–G1.6 + G4）、文件 2（G3.1/G3.3/G3.4/G3.6 + G2.3 差分 + G4 接缝）；正例 `expectTypeOf` + 负例 `@ts-expect-error`；`LocalMap`/`MiniMap` 本地表零 `declare module` 增广 | 一致，保留 |
| 无弱化 | grep 零 `skip`/`only`/`todo`；无源码字符串断言；无 env override/fallback | 通过 |
| 既有面零改动 | 既有 4 个 test-d（49 条 `@ts-expect-error`）、守卫测试、empty-module、runtime/registry T3 系、vfs3-assets 锚全零 diff | 通过 |
| 字节一致性 | `sha256(index.ts)=0d55884f7877721ded4310e9cc2ed263a60844bb1d36db2e1400640c826c47b6`，与上次报告一致 | 通过 |

**本会话 TDD 红灯重捕获（临时回退-复红-恢复）**：

1. 备份两源文件到 `/tmp/sa3-337-backup/` 并记录 sha256；
2. `git checkout -- packages/vfsl-protocol/src/index.ts packages/vfsl-codegen/src/protocol-surface.ts`（回退到 HEAD `cb8aaff`，两新测试文件保持在场）；
3. 复跑红灯命令（见 §6 R1/R2）；
4. `cp` 恢复 + `sha256sum -c` 校验 **两文件逐字节一致**（两次校验：恢复后一次，全部变异实验后再次）。

## 3. Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/vfsl-protocol/src/index.ts` | §7 D-1、D-2、§8 接口变化 1 | ① `PathValue` 之后新增第 13 名导出 `export type DeepOptional<T>`（三分支精确形态）+ doc-comment（ADR-0024 决策 7 引注、值域声明、`DeepOptional<PathAt<…>>` ≡ `DeepOptional<PathValue<PathAt<…>>>` 记法桥接、域外输入声明、判别字段不豁免、预算读非写前快照警示）；② `VfslTypedAccess.read` 之后新增第 7 方法 `readBudgeted<const P>(path, options, ...rest)` + doc-comment（L91/L92 分叉、失败通道归动态联合、fail-closed 不放松）；③ 接口头注计数「六个类型严格方法」→「七个类型严格方法（`readBudgeted` 为 #337 预算读加法）」 |
| `packages/vfsl-codegen/src/protocol-surface.ts` | §7 D-4、§11 ALLOW | `PROTOCOL_EXPORT_NAMES` 增补 `'DeepOptional'`（13 名，按 `index.ts` 声明序排在 `'PathValue'` 后）；头注如实追加 T4 增补注记一行（不改写 2026-08-21 基点描述） |
| `packages/vfsl-protocol/test/vfsl-protocol-deep-optional.test-d.ts` | §12.2 文件 1 | 新增（19 tests）：G1.1 导入、G1.2 对象递归/EOPT 负例/必填误用、G1.3 标量+`unknown`+`T \| undefined` 分发、G1.4 数组三态+索引签名+判别数组、G1.5 判别联合不豁免+精确字面量、G1.6 载体桥接正/负例、G4 if/switch 窄化；零 `declare module` 增广 |
| `packages/vfsl-protocol/test/vfsl-protocol-budget-access.test-d.ts` | §12.2 文件 2 | 新增（20 tests）：G3.1 六路径形态+根路径、G3.2 差分锁（`read` 完整形 + 双向赋值）、G3.3 `{}` 正例+必填误用、G3.4 `NonNullable` 精确、G3.6 三负例（未知路径 TS2554 / 缺 options / 形状外键）+ `read`/`kindOf` rest 门回归、G2.3 既有六方法零降级、G4 接缝镜像；本地 `LocalMap` 非增广 |

实现序（SA6 §13 / 设计 §11 红灯纪律）：两测试文件先在 HEAD 复红（本会话重捕获，§6 R1/R2）→ 源文件落位 → 全门禁。

## 4. SA2 Finding落实

| Finding ID | Implementation | Result |
|---|---|---|
| BLOCKER / MAJOR | 无此级 finding（SA2 §13） | 无待落实项 |
| N1（索引签名断言的证据归属；建议记录核验；oracle 不得放宽） | TS 5.9.3 + 仓库 EOPT 实测：`DeepOptional<Record<\`${number}\`, string>>['0']` = `string \| undefined`、整型 Equal `Record<\`${number}\`, string \| undefined>`、`kw` 路径 Equal `Record<\`${number}\`, {v?: string} \| undefined>`——与设计 pin 逐点一致，**未放宽任何 oracle** | 通过（测试 G1.4 索引项 + G3.1 `kw` 绿） |
| N2（动态 `string[]` 路径机制 = `FailClosedRest` → TS2554，非「返回 never」） | 按 TS2554 表述理解：动态（非字面量）路径 → `PathAt` → `never` → rest 门判真 → 调用缺参 TS2554（与 `read` 现行为一致，fail-closed 更强） | 记录（无验收影响） |
| N3（R-4 options 双站字面：记录一次字段对照） | 本变更集字段对照：协议内联 `{ depth?: number; maxChildrenPerNode?: number }` × doc-runtime 单源 `ReadLogicalValueAtPathOptions`（`packages/doc-runtime/src/read.ts` L74–77）**逐字段一致**；漂移哨兵 = T3 `_optionsAlias` Equal 锁 + 本票 G3.6 形状外键负例（TS2353）/运行时 `READ_OPTIONS_INVALID` | 记录（跨包单源合并归后续演进，本票零依赖边） |
| N4（可选加强：`DeepOptional<X \| undefined>` Equal 锚） | 已采纳：文件 1 G1.3 第三项 `expectTypeOf<DeepOptional<{ a: string } \| undefined>>().toEqualTypeOf<{ a?: string } \| undefined>()` | 通过 |
| N5（守卫测试头注「实测 12 名」为历史引述，无需更新） | 既有测试零改动（DENY）；权威计数注记落在 `protocol-surface.ts` 头注 T4 增补行 | 通过 |

## 5. File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/vfsl-protocol/src/index.ts` | §11 ALLOW 行 1 | `DeepOptional` + `readBudgeted` + 接口头注计数如实更新（同一 ALLOW 文件内纯注释准确性维护，零语义影响） |
| `packages/vfsl-codegen/src/protocol-surface.ts` | §11 ALLOW 行 2 | 名单跟名（SA8 §8.1 阻塞级义务）+ 头注注记 |
| `packages/vfsl-protocol/test/vfsl-protocol-deep-optional.test-d.ts` | §11 ALLOW 行 3 | G1/G4 语义锚落盘 |
| `packages/vfsl-protocol/test/vfsl-protocol-budget-access.test-d.ts` | §11 ALLOW 行 4 | G3/G2.3/G4 接缝锚落盘 |

范围外零改动（`git status` + `git diff --stat` 实证）：`packages/namespace-runtime/**`、`packages/namespace-registry/**`、`packages/doc-runtime/**`、`packages/vfsl/**`、`domains/**`、`docs/**`、`CONTEXT.md`、`apps/**`、`pnpm-lock.yaml`、`packages/vfsl-protocol/package.json`（`dependencies` 零新增）、既有测试文件全零改动。临时探针目录 `.scratch/sa3-337/` 已删除（`git status` 无残留）。

## 6. Verification

> 本会话（iteration 1）实测；日志均为本次重跑覆盖写入。

**红灯（先把两源文件回退到 HEAD，测试文件在场）**

| # | Command | Result | Evidence |
|---|---|---|---|
| R1 | `pnpm exec tsc -p packages/vfsl-protocol/tsconfig.json`（HEAD 源） | 红 exit 2：**24 错** = `TS2305 has no exported member 'DeepOptional'` ×1（文件 1 L26）+ `TS2339 Property 'readBudgeted' does not exist on type 'VfslTypedAccess<LocalMap>'` ×13 + 级联 `TS2578 Unused '@ts-expect-error'` ×10 | `artifacts/sa3-issue337-red-package-tsc.log` |
| R2 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/vfsl-protocol/test --typecheck --passWithNoTests=false`（HEAD 源） | 红 exit 1：**2 failed \| 3 passed (5 files)；18 failed \| 41 passed；Type Errors 18 failed**——同目录既有 3 文件全绿（含 20 条既有 `@ts-expect-error`），红仅落在两新契约文件且归因 = 目标能力缺失 | `artifacts/sa3-issue337-red-contract.log` |
| R3 | 恢复两源文件 + `sha256sum -c` | `index.ts: OK`、`protocol-surface.ts: OK`（逐字节恢复；变异实验后再次校验 OK） | `artifacts/sa3-issue337-final-state.log` |

**绿灯（实现落位后）**

| Command | Result | Evidence |
|---|---|---|
| `pnpm exec tsc -p packages/vfsl-protocol/tsconfig.json` | exit 0 | `artifacts/sa3-issue337-package-tsc.log` |
| `pnpm exec tsc -p packages/vfsl-codegen/tsconfig.json` | exit 0 | 同上 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/vfsl-protocol/test packages/vfsl-codegen/test packages/namespace-runtime/test packages/namespace-registry/test --typecheck --passWithNoTests=false` | exit 0：**109 files / 1018 tests passed；Type Errors: no errors**。基线 107/979 → +2 files/+39 tests，恰为新文件（`vfsl-protocol-budget-access.test-d.ts` 20 tests ✓、`vfsl-protocol-deep-optional.test-d.ts` 19 tests ✓、`generate-alias-collision-guard.test.ts` 4 tests ✓、`vfsl-protocol-empty-module.test.ts` 1 test ✓） | `artifacts/sa3-issue337-targeted-vitest.log` |
| `pnpm typecheck`（root 14 project，含 namespace-runtime/registry/yjs-server） | exit 0 | `artifacts/sa3-issue337-root-typecheck-generate.log` |
| `pnpm generate --check` | exit 0（生成物零漂移；`PROTOCOL_IMPORT_LINE` 与生成器输出规格零 diff） | 同上 |
| `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（root） | exit 0：**352 files / 3880 tests passed；Type Errors: no errors**（基线 350/3841 → +2 files/+39 tests；596.10s） | `artifacts/sa3-issue337-root-test.log` |
| 最终态复验（变异复原后）：两包 `tsc` + `vitest run packages/vfsl-protocol/test packages/vfsl-codegen/test --typecheck --passWithNoTests=false` | exit 0：**14 files / 154 tests passed；Type Errors: no errors**；sha256 两文件 OK | `artifacts/sa3-issue337-final-state.log` |

**导出面 + 守卫实测（本会话临时探针 `.scratch/sa3-337/export-surface.ts`，用后删除）**

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx .scratch/sa3-337/export-surface.ts` | `actual.count=13` = `frozen.count=13`、`actual-only=[]`、`frozen-only=[]`、`has_DeepOptional_actual=true`、`has_DeepOptional_frozen=true`；`alias<DeepOptional> -> THROW(code=alias-protocol-export-collision)`（SA8 §8.1：加名后该别名从「静默 NO-THROW」转为响亮失败）；`guardSilent=[]` | `artifacts/sa3-issue337-export-surface.log` |

**变异敏感性（临时改 `index.ts` 后**已复原**，逐次 `tsc -p packages/vfsl-protocol/tsconfig.json` + sha256 校验）**

| 变异 | 预期 | 实测 | Evidence |
|---|---|---|---|
| D2 对象分支非 EOPT（`? ... \| undefined`） | G1.2 `{a: undefined}` 负例自反转 | **1 错**，恰为 `vfsl-protocol-deep-optional.test-d.ts(57,5) TS2578 Unused '@ts-expect-error'`（即 EOPT 负例探针），正是 SA6 §12.5 D2 判据 | `artifacts/sa3-issue337-mutation-sensitivity.log` |
| D3 对象分支丢 `?`（浅层不递归） | G1.2/G3.1 形状断言红 | **30 错**（两文件，`TS2344` 形状不符） | 同上 |
| D4 变长数组元素补 `\| undefined` | G1.4 三态 + G3.1 `plainArr` 红 | **6 错** | 同上 |
| 复原 | 逐字节一致 | `sha256sum -c` 两次 OK | 同上 / `final-state.log` |

**归因正确性与负向锚**

- 红灯归因 = 目标能力缺失本身（TS2305 / TS2339），非环境/fixture/入口错误：同目录既有 3 文件在红灯运行中全绿；SA6 P4 同型实证；`--passWithNoTests=false` 防静默假绿。
- 未弱化任何既有负向锚：4 个既有 test-d 的 49 条 `@ts-expect-error` 零改动，root 门禁 0 type errors 证明全部仍为真错误；新增 18 条 `@ts-expect-error`（文件 1 ×7、文件 2 ×11）全部为真错误（无 TS2578）。无 `skip`/`only`/`todo`（grep 实证）、无源码字符串断言、无 env override/fallback/吞错。
- AC1 零降级：runtime/lease/yjs-server/`doc-runtime`/`vfsl` 面 **零 diff**，`ReturnType` 末签名锁、`_readAlias`/`_readBudgetAlias`/`_readOverloadOrder` Equal 锁、typed-stub 编译锁、单参动态消费方（`apps/yjs-server/src/app.ts` L609）全部原样经 root typecheck/test 保护。

## 7. Deferred verification

按技能边界，以下不属于 SA3 验证范围，交由后续角色：

- **SA8 implementation 复查**（`requiresConflictRecheck=true`）：名单成对落盘（已实测 13=13、`silent=[]`）、runtime/registry 零 diff、既有 12 名/六方法语义零改动、负向锚保持红、empty-module `Object.keys===[]`、`dependencies` 零新增、`generate --check` 零漂移、doc-comment 桥接与分叉说明在位、红灯纪律执行顺序。
- **SA4/SA7**：独立复跑与活链路验证。
- **T5 #338（非本票义务）**：typed-access 预算纪律文档（`readBudgeted` 宿主接线示例）、文档负控正则修订、`docs/integration` 形状注记、ADR 0008/0016 回填——本票零触碰。
- **发布面**：`VfslTypedAccess` 接口加法对库外「实现者」的破坏面按 0.x minor bump 先例随 `@nomicore/vfsl-protocol` 发布流处理（设计 R-5）。
- 设计残余风险 R-1（病态深 schema 的实例化深度）/R-2（判别窄化的 TS 版本敏感）由 G4 锚与 root 门禁作哨兵，本票不另行测量。

## 8. Deviations or blockers

- **无 deviation、无 blocker**（重试派发亦无 schema/observer 相关业务阻塞）。
- 设计未逐条列出的实现内注释更新一处：`VfslTypedAccess` 接口头注计数「六个类型严格方法」→「七个类型严格方法（`readBudgeted` 为 #337 预算读加法）」——同一 ALLOW 文件内的准确性维护（设计 §8 声明该方法为第 7 个），零语义影响。
- 一处 oracle 实施说明：文件 2 的差分/根路径断言按设计「不得经 `ReturnType` 取型」纪律，一律经 `typeof <调用表达式>` 取型（`ReturnType` 会把泛型方法返回型擦除到约束）。
- 临时产物已清理：`.scratch/sa3-337/`（探针）删除、`/tmp/sa3-337-backup/` 为 worktree 外备份（不影响仓库状态）；`git status` 无 `.scratch` 残留。

## 9. Suggested commit message

```
fix(#337): [shape-budget] T4: DeepOptional 预算读类型面

- vfsl-protocol: 新增第 13 名纯类型导出 DeepOptional（读值域递归可选：对象全字段
  可选并递归、变长数组元素递归不加多余 | undefined 且 readonly 保留、元组元素可选、
  索引签名值位补 | undefined、标量/字面量联合原样、判别字段不豁免；doc-comment 载
  ADR-0024 决策 7 记法桥接与非写前快照警示）
- vfsl-protocol: VfslTypedAccess 新增第 7 方法
  readBudgeted<const P>(path, {depth?, maxChildrenPerNode?}, ...rest)
    → DeepOptional<PathValue<PathAt<Map, NoInfer<P>>>>
  fail-closed rest 与 read 同机制（未知路径 TS2554），既有六方法与 read 承诺零改动
- vfsl-codegen: PROTOCOL_EXPORT_NAMES 同变更集跟名 'DeepOptional'（13 名，
  碰撞守卫 silent=[] 绿；头注如实追加 T4 注记）
- test: 新增 vfsl-protocol-deep-optional.test-d.ts（19 tests，G1.1–G1.6 + G4）与
  vfsl-protocol-budget-access.test-d.ts（20 tests，G3/G2.3 差分/G4 接缝）
- 零运行时 diff：runtime/registry/lease/yjs-server/生成物/文档零触碰；
  AC1 由零 diff + 既有 Equal 锁/typed 读/动态消费方锚全绿逐点成立
```
