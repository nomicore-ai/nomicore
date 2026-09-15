# SA3 Implementation Report — issue #383（ADR 0029 P3，缝 2：runtime + registry）

- 任务类型：Feature（能力缺口兑现）——已接受 ADR 0029 验收缝 2 的实现票。
- 基线：worktree `/home/wangjian/nomicore-fix-issue-383`，branch `mabf/issue-383`，HEAD `de2ff55`（与设计/评审基线一致）。
- 实现范围：`window-read.ts` 组合层（S3 镜像扩展 + S6 双语义）+ 测试先例 P1–P6 + 文档对齐 §5.6；registry 与 doc-runtime 源零 diff。

## Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-383.md`（AC1–AC8；评论 REST 为空） | 验收面 |
| `wiki/raw/task_issue-383_design.md`（iteration 1，§5.1/§5.2/§5.6/§7/§8） | 实现蓝图 + ALLOW/DENY |
| `wiki/raw/task_issue-383_sa2_review.md`（approve；F-383-S2-1 已消解 + 观察 1–5） | 落实核对 |
| `wiki/raw/task_issue-383_sa6_contract.md`（B-1–B-15、§12.3 用例组、P1–P6、§14 运行器） | 红灯契约与验证命令 |
| `wiki/raw/task_issue-383_conflict_report.md`（clear；A1–A6、F1–F11、R16） | 冻结面/执行义务 |
| `docs/adr/0029-filtered-window-read.md` §1–§8、`docs/adr/0028-window-read.md`、`CONTEXT.md`「窗口读」「过滤窗口」 | 语义权威 |
| `packages/doc-runtime/src/window.ts`（W1 权威校验 W-1–W-13、过滤、`total` 双形态） | 镜像判据锚 |
| `packages/namespace-runtime/src/{window-read.ts,runtime.ts}`、`packages/namespace-registry/src/lease.ts` | 现状事实 |

## Existing worktree reconciliation

- 实现前无 `wiki/raw/task_issue-383_sa3_impl.md`，无未提交实现：`git status --porcelain` 仅 Host 五件 wiki 产物（`task_383_dispatch.md` 与四份任务产物）。无可复用/待修正的过时实现。
- 无历史遗留：`grep -rn "seamWhereNotImplemented"`（排除 wiki）实现后零命中。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-runtime/src/window-read.ts` | §5.1/§5.2/§7 ALLOW ①② | 删除缝 1 入口 fail-closed 分支与 `seamWhereNotImplemented`；S3 `canonicalWindowBudget` 白名单四键 → 五键 + `where` 判据镜像 `canonicalWhere`（`WHERE_TERM_LIMIT` 具名常量）+ ok 分支携带 canonical `n`；S6 `truncated` 双语义（`total === undefined ? kept === canonical.n : kept < total`）+ ✂ 结构性永不装配（`appendWindowFacts` 只在 `total !== undefined` 分支）；模块头注/类型注释/`WindowComposeInput.total` 注释同步 |
| `packages/namespace-runtime/src/runtime.ts` | §7 ALLOW ②（可选注释） | `readArray` 组合体 doc 注释补双语义/五键镜像措辞；**行为零改动** |
| `packages/namespace-runtime/test/issue-383-window-where-composition-red.test.ts`（新建） | SA6 P1 / §12.3 A/T/X/K/D/Z/S/F/C + §6 N | runtime 组合面 54 用例 |
| `packages/namespace-registry/test/issue-383-lease-where-contract-red.test.ts`（新建） | SA6 P2 / §12.3.7 L1–L6 + T11/X8/D3/C4/M1 | lease 面 16 用例 |
| `packages/namespace-registry/test/issue-383-filtered-window-fixture.ts`（新建，非测试文件） | SA6 P3 / §12.3 FIX-383-A | 共享 fixture（MemoryPersistence/StubPersistence 同 doc + 确定性 clock/randomBytes + schema ready 轮询） |
| `packages/namespace-runtime/test/issue-383-window-where-type-guard.test-d.ts`（新建） | SA6 P4 / Y1/Y2/Y3/Y6 | 编译期边界（14 条 `@ts-expect-error` + 单源别名 Equal 锁） |
| `packages/namespace-registry/test/issue-383-lease-where-type-guard.test-d.ts`（新建） | SA6 P5 / Y1/Y4/Y5 | lease 面编译期边界（含 `WhereTerm` 两侧 TS2694 锁定） |
| `AGENTS.md` | §5.6 / M5 / A6 | 窗口读签名补 `where?`；`truncated`/✂ 句补 where 限定（指向 CONTEXT.md「过滤窗口」） |
| `.agents/skills/nomicore/typed-access.md` | §5.6 / `F-383-S2-1` ① | 词表段补 `where` 形态/合取/响亮拒绝 + 计数降级；✂ 段补双语义（装满判定、✂ 永不装配、`kept < n`=完备匹配集）；失败处置补 malformed `where` |
| `docs/integration/cordis-plugin-hosting.md` | §5.6 / `F-383-S2-1` ① | options 注释补 `where`；`truncated` 注释补双语义；✂ 样张标注「where 缺席形态」 |
| `.agents/skills/nomicore/SKILL.md` | §5.6 / `F-383-S2-1` ③ | 路由行括注补 `optional where equality filter`（gloss 不陈述截断语义） |

## SA2 Finding落实

| Finding / 观察 | Implementation | Result |
|---|---|---|
| `F-383-S2-1` ①②③④（文档对齐范围） | 四文档按 §5.6 逐行补注：根 `AGENTS.md` 签名 + 双语义限定；`typed-access.md` 词表/✂/计数三处；`cordis-plugin-hosting.md` 三处；`SKILL.md` 短语级能力提及。措辞逐点取自 CONTEXT.md「过滤窗口」与 ADR 0029 §5，零行为发明；`app-data-access-skill.md` 零改动 | 落实（`git status` 证据：四文档 modified、`app-data-access-skill.md` 未改） |
| 观察 1（`CanonicalWindowBudget` ok 分支不携 `n`） | ok 分支扩为 `{ ok:true, budget, term, n }`；S6 用 `canonical.n` 做装满判定（`kept === canonical.n`） | 落实（§7 ALLOW ②点名改形） |
| 观察 2（§5.2「L221–254 不动」措辞） | 宿主判据与轴值判据逐字节保持；区间内仅白名单条件与返回形状两处改写 | 落实 |
| 观察 3（双合法视图值漂移 SC-8） | runtime 测试 Z 组头注文档化（与 `canonical.term`/`canonical.budget` 同族，#369 已接受暴露类）；无新用例、无新出口 | 落实（Z 组头注） |
| 观察 4（F1/F2/F4 HEAD 颜色） | **实测回填**：HEAD 处 F1/F2/F4 已绿（W1 失败透传先于组合层；红跑输出 `/tmp/sa3-383-red.out` 中 F 组 5 用例全 ✓）——设计 §12 预测成立，按预绿守卫登记 | 落实并回填 SA6 |
| 观察 5（哨兵具名常量 + 出处注释） | `const WHERE_TERM_LIMIT = 16`（模块私有、不导出）+ 出处注释（doc-runtime `window.ts`，导出违 F9） | 落实 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/src/window-read.ts` | §7 ALLOW ① | 唯一生产实现落点 |
| `packages/namespace-runtime/src/runtime.ts` | §7 ALLOW ②（仅注释、可选） | 注释同步 |
| `AGENTS.md` | §7 ALLOW | A6/M5 文档对齐 |
| `.agents/skills/nomicore/typed-access.md` | §7 ALLOW | `F-383-S2-1` ① |
| `docs/integration/cordis-plugin-hosting.md` | §7 ALLOW | `F-383-S2-1` ① |
| `.agents/skills/nomicore/SKILL.md` | §7 ALLOW | `F-383-S2-1` ③ |
| 五个 `issue-383-*` 测试/fixture 路径 | §7 ALLOW（SA6 P1–P5 同名路径） | 红灯契约与类型边界 |

- **DENY 面零触碰**：`packages/doc-runtime/src/**` 零 diff（F9）；`packages/namespace-registry/src/**`（`lease.ts`/`types.ts`/`index.ts`）零 diff（F10/S6）；`packages/namespace-runtime/src/index.ts` 零 diff；`CONTEXT.md`/`docs/adr/**`/`docs/integration/app-data-access-skill.md` 零 diff；既有 #369/#382 测试与公共面守卫测试零改动（M1/M6/M7）。
- 零配置改动（`vitest.config.ts`/`tsconfig*.json`/包 `package.json` 未动；新文件按命名自动采集）。

## Verification

| Command | Result | Evidence |
|---|---|---|
| `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck packages/namespace-runtime/test/issue-383-window-where-composition-red.test.ts packages/namespace-registry/test/issue-383-lease-where-contract-red.test.ts`（**实现前** HEAD） | **38 failed / 30 passed（68）**，`Type Errors no errors`，exit 1——红因统一 = 缝 2 未实现（入口 fail-closed / S3 四键白名单）；无 where 组、生命周期组、失败码组、冻结面组全绿 | `/tmp/sa3-383-red.out` |
| 同上（**实现后**） | **2 files / 70 tests passed**，`Type Errors no errors`，exit 0 | 本次运行输出 |
| SA6 §14 聚焦家族 + 本票新增契约（6 文件）：`…vitest run --typecheck packages/doc-runtime/test/issue-382-where-window-contract-red.test.ts packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts packages/namespace-runtime/test/issue-383-window-where-composition-red.test.ts packages/namespace-registry/test/issue-383-lease-where-contract-red.test.ts` | **6 files / 199 tests passed**，`Type Errors no errors`，exit 0（既有 129 用例零改红 + #382 条件不变式 M1 绿） | `/tmp/sa3-383-focused.out` |
| `npx tsc -p tsconfig.typecheck.json --noEmit`（含两个新 `.test-d.ts`；Y 组 @ts-expect-error 全命中） | exit 0 | `/tmp/sa3-383-tsc.out` |
| `pnpm typecheck`（14 个 tsc 工程，AC8 门） | exit 0 | `/tmp/sa3-383-pnpm-typecheck.out` |
| `pnpm test`（全仓，AC8 门） | **exit 0**：400 files / 4903 tests passed，`Type Errors no errors`，610.24s | `/tmp/sa3-383-pnpm-test.out` |
| 形状断言收敛门 + 公共面守卫：`…vitest run --typecheck readdata-shape-assertion-consolidation-gate.test.ts registry-surface.test.ts runtime-close-lifecycle.test.ts` | **3 files / 46 tests passed**，exit 0（新测试零形状字面量；registry 主入口 9 值 / lease 15 键 / runtime 14 键冻结面保持） | 本次运行输出 |
| 文档门（§8 验收 grep）：`grep -rn "kept < total" --include="*.md" .`（排除 `wiki/`、`docs/adr/`、`CONTEXT.md`） | 命中恰 4 处且**全部带 where 限定**（根 `AGENTS.md` L31、`typed-access.md` L172、`cordis-plugin-hosting.md` L413/L418）；`SKILL.md` gloss 含 where 能力提及且不含截断语义 | 本次运行输出 |
| 结构审计 S1/S6（`git diff --stat -- packages/doc-runtime/src` / `-- packages/namespace-registry/src`） | 均为空（F9 零 diff / F10 零解释） | 本次运行输出 |
| 结构审计 S3/S4（`grep`：无 `total ??`/无 `kept < undefined`、`appendWindowFacts` 仅在 `total !== undefined` 分支、白名单恰五键 `n/orderBy/depth/maxChildrenPerNode/where`、`WHERE_TERM_LIMIT` 具名常量） | 通过（唯一 `as number` 为 `isScalarEquals` 对 `unknown` 的 `Number.isFinite` 收窄，非 `total` 兜底） | 本次运行输出 |
| `git diff --check` | 干净（无空白错误） | 本次运行输出 |

### 全仓门结果

`pnpm test` → **exit 0**：`Test Files 400 passed (400)` / `Tests 4903 passed (4903)` / `Type Errors no errors` / `Duration 610.24s`。
实现前基线为 396 files / 4827 tests：本票新增 2 个 `.test.ts`（runtime 组合面 54 用例 + lease 面 16 用例 = 70）与 2 个 `.test-d.ts`（P4 3 用例 + P5 3 用例 = 6，typecheck 段计入文件与用例数）→ 396+4 = 400 files、4827+76 = 4903 tests，逐位对账（fixture 为非测试文件，不采集）。既有 396 文件全绿（零改红）。

收尾复核：临时探针已删除（`packages/{namespace-runtime,namespace-registry}/test` 无 `__sa3_*`/probe 残留）；`git status --porcelain` 仅本报告 + §7 ALLOW 面改动 + Host wiki 产物。

## Deferred verification

- **SA4/SA7**：活链路/动态验收、冻结面（F2–F11）实现后逐项复核、R16 中间态清账复核（`requiresConflictRecheck: true`，SA8 §10 义务）。
- **SA8 冲突复查**：本票把 `where` 落到公共 options 词表与失败语义、truncated 双语义与 ✂ 规则——需按 ADR 0029 §5/§6 复核（设计 §13 已列）。
- 未新增任何测试基础设施/fixture 复用面（#369 fixture 零漂移；新 fixture 为独立文件）。

## Deviations or blockers

无阻塞项。两处 SA6 契约内部不一致按「fixture 事实 + 独立预言机」落地并登记（不弱化任何断言、不改验收语义）：

1. **§12.3.1 A3 的 total 锚**：契约写 `truncated === true（kept 1 < 独立预言机 total 2）` 且 ✂ 行 `kept 1/total 2`，但同契约 FIX-383-A 的 `taskList` 是 3 元素（`[claimed(2), done(9), claimed(5)]`，且 T9 的 `[0,2]` 与 `2 < 3` 要求 3 元素）。实现按 fixture 事实与独立预言机（`Y.Array.length` = 3）断言 `kept 1/total 3`，语义面（desc 自尾取窗、truncated=true、字节锚）与契约一致。
2. **§12.3.1 A4 的后半**：契约写 `lease.readArray(['scalarList'],{n:2})` → `value:[]`、`truncated:false`，但 FIX-383-A 的 `scalarList` 是 `[1,2,3]`（非空；数组面标量元素仅在 where 在场时安静不匹配）。实现拆为两条等价断言：`emptyTasks`（空 Record）→ `[]`/`false`/无 ✂，`scalarList` 全量窗（`n = 独立预言机 length`）→ `truncated:false`/无 ✂；where 在场下 `scalarList` 全安静不匹配 → `[]`/`false` 由 T7 承载。
3. **§12.3.9 F1/F2/F4 的 HEAD 颜色回填**：实测 HEAD 即绿（见上表观察 4），按预绿守卫登记回填。

## Suggested commit message

```
fix(#383): [ADR 0029] P3 — 过滤窗口组合面与 lease 类型（缝 2：runtime + registry）

- window-read.ts：取代缝 1 入口 fail-closed（seamWhereNotImplemented 清账）；
  S3 canonicalWindowBudget 白名单四键 → 五键 + canonicalWhere 判据镜像
  （W1 validateWhere/validateWhereTerm 逐条对齐：数组/length/非空/≤16/空洞/
  accessor/原型/恰两键/field/equals 标量闭集；零 [[Get]]、trap 收编；两出口复用）；
  ok 分支携带 canonical n；S6 truncated 双语义（无 where = kept < total；
  有 where = kept === canonical n 装满判定）与 ✂ 结构性永不装配。
- registry 零改动（released 短路 + raw 直传 + 单源别名链已承载 where）。
- 测试：新增 issue-383 组合面/lease 面红灯契约 + FIX-383-A fixture + 两个
  类型守卫 test-d（A/T/X/K/D/Z/S/F/C/L/Y/M1 用例组；#369/#382 家族零改红）。
- 文档：根 AGENTS.md、typed-access.md、cordis-plugin-hosting.md、SKILL.md 补
  可选 where 与 truncated 双语义限定（措辞以 CONTEXT.md「过滤窗口」/ADR 0029 §5 为权威）。
```
