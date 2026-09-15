# SA3 Implementation Report — issue #382：[ADR 0029] P2 `where` 过滤原语（缝 1：doc-runtime）

- 角色：SA3（TDD 实现执行者）；dispatch `sa-34864478-43cc-451c-a169-8f49c7860975`；iteration 0。
- 基准快照：worktree `/home/wangjian/nomicore-fix-issue-382`，HEAD `1b639e0ebe825ffbbfce377850c01ef620734f47`（#381 P1 已入，与设计 §基准快照一致）。
- 结论：缝 1 实现完成（W1 `where` 合取过滤 + `total` 值域加宽 + 类型面 + 组合层入口 fail-closed），SA6 红灯契约（C/D/V/P/T/Z/F/Y 组 + registry P4）在 HEAD 红、实现后全绿；受影响包 typecheck、仓级 `pnpm typecheck`（14 工程）与仓级 `pnpm test`（396 文件 / 4827 用例，AC8）全 exit 0；SA8 A6′ 要求的 D8 变异探针**前后双态证据**与 S1–S4 结构审计（含 S4 增补检查位）齐全。

## Inputs consumed

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-382.md`（简报，AC1–AC8） | 验收面来源；无 owner 评论（Comments 段空） |
| `wiki/raw/task_issue-382_design.md`（SA1 iteration 1 评审修订版） | 唯一实现依据：§8 接口/判据/管线、§11 ALLOW/DENY、§12 验收映射、§13 风险、§14 评审修订映射 |
| `wiki/raw/task_issue-382_sa2_review.md`（SA2，`approve`，R-1–R-4 MINOR） | 逐条落实核对（见「SA2 Finding 落实」） |
| `wiki/raw/task_issue-382_sa6_contract.md`（SA6，`approve`） | §12.1 B-1–B-11、§12.3.1–§12.3.7 用例组、§12.3.8 Y1–Y5、§12.4 M1–M5、§12.6 S1–S4、§12.7 反伪绿防线、§14 运行器命令 |
| `wiki/raw/task_issue-382_relevant_decisions.md` + `_conflict_report.md`（SA8 前置门禁 `clear`，A1–A5/F1–F8） | 词表纪律、缝序一致性、公共面守卫、冻结面 |
| `wiki/raw/task_issue-382_design_conflict_report.md`（SA8 设计后复审 `clear`，A1′–A4′ + **A6′**） | D8 分支形态纪律（入口第一句/键于 W1 结算/单源四键构造）+ 敌意漂移**行为级**证据义务 |
| `docs/adr/0029-filtered-window-read.md`（accepted）、`docs/adr/0028-window-read.md`、`CONTEXT.md` L61–67 | 规范权威：§1–§8 + 三缝验收 |
| `packages/doc-runtime/AGENTS.md`、`packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md` | 模块边界（公共面只经 `src/index.ts`、读不进 sequencer、lease 零校验透传） |

## Existing worktree reconciliation

开工时 worktree 已存在**未提交实现**（3 个 src 修改 + 2 个既有测试迁移 + 3 个新测试文件），且无 `task_issue-382_sa3_impl.md`——按「当前待修订状态」处置：逐文件对照 design iteration 1 的 §8/§11/§12 与 SA6 §12 映射复核。

| 复核项 | 结果 |
|---|---|
| `window.ts`：§8.1 类型面（`WhereTerm` / 两面 options `where?` / 成功面 `total: number\|undefined` / `NormalizedWhereTerm` / `ValidatedWindowOptions.where`） | 符合，保留 |
| `window.ts`：§8.3 W-1–W-14 判据（五键白名单、descriptor 纪律、数组性/长度/元素、plain 原型、恰两键、field 零强制转换、equals 闭集 + finite + 零 truthiness、双必填、trap 收编、相邻面不放宽） | 符合，保留 |
| `window.ts`：§8.4 E+W 内联过滤（map 面复用循环内已读 child 值；array 面 where 在场逐下标原始读一次、`where` 缺席零元素读）+ A 阶段单点 `total` 分支 | 符合，保留 |
| `window.ts`：§8.1 模块头注释改写、§8.2 `src/index.ts` type-only 导出 + 头注 | 符合，保留 |
| `window-read.ts`：§8.6 / D8 入口 fail-closed（签名加宽 + 新私有构造器 + 注释），S3/canonicalOrderBy 判据体零改动 | 符合，保留 |
| 迁移 M1（`total` 钉加宽）、M2（`WhereTerm` 记账/投影断言）、M3（#368 头注 B-5 注释同步） | 符合，保留 |
| 新测试三文件（doc-runtime 行为契约 C/D/V/P/T/Z + F1–F6 + NC；doc-runtime 类型契约 Y1–Y4；registry P4 条件不变式） | 符合 ALLOW 与 D10，保留 |
| 过时/不完整/冲突实现 | 设计面**零发现**；本轮除证据日志与本报告外未再改动 src |
| 仓级门（AC8 全仓测试）捕获的收敛门违规 | 新 registry 测试 `issue-382-lease-where-no-silent-pass.test.ts` 中以字面量断言 lease 成功面恒四键键集，违反 issue #333/#336/#364 的形状断言集中化门（`readdata-shape-assertion-consolidation-gate.test.ts` family B）→ **已修复**：改用集中化 helper `expectReadDataOkKeys`（与 #369 lease 契约测试同款，registry 测试树既有相对导入先例）；证据见 `artifacts/sa3-issue382-full-test-pre-fix-gate-red.log` 与修复后复跑 |

（本轮「修正」类动作仅两处：① 仓级门捕获的新 registry 测试收敛门违规 → 改用集中化 helper；② 审计期 D8 临时变异（删分支 / `?? 0`）仅存在于探针运行期间，随后逐字节还原，见下文双态证据与 `diff` 校验。src 实现本身无修正。）

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/doc-runtime/src/window.ts` | §8.1/§8.3/§8.4/§8.7、D2–D7、A4 | `WhereTerm` 类型 + `WHERE_TERM_LIMIT = 16`；两面 options `where?: readonly WhereTerm[]`；成功面 `total: number \| undefined`；`ValidatedWindowOptions.where` + `NormalizedWhereTerm`；OPT 五键白名单 + `validateWhere`/`validateWhereTerm`/`validateWhereEquals`（descriptor 纪律、零 `[[Get]]`、trap 收编、防御性浅拷贝）；E+W 内联过滤（`enumerateArrayCandidates`/`enumerateMapCandidates` 增 `where` 形参；`whereMatches`/`matchesWhereTerm` 复用 `drillField` 单段下钻）；A 阶段 `total: where === undefined ? candidates.length : undefined`；模块头注释同步 |
| `packages/doc-runtime/src/index.ts` | §8.2、A3、M2 前置 | `export type { WhereTerm }`（type-only，并入既有窗口类型 `export type` 块，字母序 `'Wh' < 'Wi'`）+ ADR 0029 加法头注；值导出面零新增（P-W1/P-W2 保持恰两枚） |
| `packages/namespace-runtime/src/window-read.ts` | §8.6、D8、M5、SA8 A2/A2′ | `WindowComposeInput.total` 与 `composeArrayWindowRead`/`composeMapWindowRead` 形参加宽 `number \| undefined`；`composeWindowRead` **函数体第一句** `if (input.total === undefined) return seamWhereNotImplemented(input.path);`（先于 S3、键于 W1 结算结果、不重读 options）；新私有四键构造器 `seamWhereNotImplemented`（复用 `windowFailure` + `safePathCopy` 单源）；注释；**S3 `canonicalWindowBudget`/`canonicalOrderBy` 判据体零改动** |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | §8.5 M1/M2 | `total` 类型锁 `number` → `number \| undefined`（两面）+ 注释同步；`WhereTerm` 导入（字母序插于 `WindowDir` 前）、`declare const whereTerm`、窗口 describe 内投影断言（`field: string`；`equals: string\|number\|boolean\|null`；两面 `where: readonly WhereTerm[] \| undefined`） |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | §8.5 M3 | 头注 B-5 注释级同步（「成功面恰三键由 P7/类型锁承载；#382 起 `total` 值域加宽」）——零断言改动 |
| `packages/doc-runtime/test/issue-382-where-window-contract-red.test.ts`（新建） | §11 ALLOW、D10、SA6 §12.3.1–§12.3.7 + §6 NC | `FIX-382-A` fixture（四载体族 + dirty 矩阵 + 毒值哨兵）；独立预言机（Yjs/native 直数）；C1–C11 / D1–D12 / V1–V21 / P1–P5 / T1–T6 / Z1–Z8 / F1–F6 + NC1–NC8；零跨包 import |
| `packages/doc-runtime/test/issue-382-where-window-type-guard.test-d.ts`（新建） | §11 ALLOW、SA6 §12.3.8 Y1–Y4 | 类型契约：`WhereTerm` 可导入、两面 `where` 投影、`total: number \| undefined`、成功面恰三键、`@ts-expect-error` 编译期负例（闭集外 equals / 未知键 / 非数组 where / 语境外 orderBy） |
| `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts`（新建） | §11 ALLOW、SA6 §12.5 P4、SA8 A2 | lease 面 `where` 条件不变式（`ok:true ⟹ 条目全满足谓词`；`ok:false ⟹ 码 = WINDOW_OPTIONS_INVALID`）+ 无 where 四键基线负控（经集中化 helper `expectReadDataOkKeys` 断言，避免违反 #333/#336/#364 收敛门）；复用 #369 window fixture |
| `artifacts/sa3-issue382-*.log`（12 份） | ⚠ 非源码范围：设计 §12 P6 / SA8 A6′ 明令「记入实现票 artifacts 与 S1–S4 同列登记」；沿仓内既有 SA3 证据惯例（`artifacts/sa3-issue381-*.log`） | 实现证据（行为/类型红灯基线、聚焦家族绿、包/仓 typecheck、仓级测试门、结构审计 S1–S4、D8 探针双态 + 变异编译期可见性、收敛门违规首轮红基线），非产品代码 |
| `wiki/raw/task_issue-382_sa3_impl.md`（本文件） | SA3 skill 固定产物 | 实现报告 |

未改动（DENY 全域核验）：`packages/doc-runtime/src/read.ts`（零 diff）、`packages/namespace-runtime/src/runtime.ts`（零 diff）、`packages/namespace-registry/src/lease.ts`/`types.ts`、`issue-368-*.test.ts`/`issue-381-*.test.ts`/`public-surface-guard.test.ts`/`#369` 全部测试、`CONTEXT.md`、`docs/**`、`vitest.config.ts`/`package.json`/`tsconfig*.json`。

## SA2 Finding 落实

| Finding ID | 实现 | 结果 |
|---|---|---|
| R-1（D8 落点论据修正：类型收窄必须在消费点 + 窗口域失败构造单源） | 分支落在 `window-read.ts` `composeWindowRead`（S6 `kept < total` 的消费文件），收窄单点完成（`const total = input.total;` 无 cast）；失败构造复用本模块单源 `windowFailure`（`{code,ok,path,message}` + `safePathCopy`），未在 `runtime.ts` 另造窗口失败面 | 落实；`runtime.ts` 零 diff 且 `pnpm typecheck` exit 0（无 `?? 0`/`as number`） |
| R-2（D8 独占防御缺行为级钩子） | ① 变异探针双态证据（`artifacts/sa3-issue382-d8-probe.log`）：变异态（删分支 + `?? 0` 软化）分视图 Proxy 经 lease 观测到**静默已过滤四键成功面** `ok:true truncated=false keys=["t3"]`；还原后同调用 `ok:false code=WINDOW_OPTIONS_INVALID`。② S4 增补检查位（分支在场 / 位于 `composeWindowRead` 函数体第一句 / 先于 S3 / 键于 W1 结算 `total === undefined`）——`artifacts/sa3-issue382-structural-audit.log` | 落实（探针有牙 + 分支存活双证；临时探针文件已删除） |
| R-3（F7 归位：新契约文件零跨包 import） | doc-runtime 契约文件仅含 C/D/V/P/T/Z + F1–F6，只 import `../src/index.js`；F7 严格形态以实现期审计证据登记（见 S4/A6′），耐久形态落 `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts` | 落实（F7 严格断言**未**写成持久测试，无跨包反向依赖） |
| R-4（短路口径注） | 实现 = 单遍全枚举 + 内联过滤 + 匹配集排序 + 取前缀（D7），无第二读路径/流式分叉；可观测等价由 P5/Z5 锚定（n=2/5 两向、`total` 恒 undefined、命中集恒同） | 落实；简报「位置序短路」以可观测等价兑现，成本短路留作登记演进位（Follow-up ②） |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/doc-runtime/src/window.ts` | ✅ ALLOW 行 1（唯一实现落点） | §8.1/§8.3/§8.4 实现 |
| `packages/doc-runtime/src/index.ts` | ✅ ALLOW 行 2 | §8.2 type-only 导出（A3） |
| `packages/namespace-runtime/src/window-read.ts` | ✅ ALLOW 行 3（仅签名/入口分支/注释；S3 判据体 DENY 未触） | D8 中间态响亮（M5/A2′） |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | ✅ ALLOW 行 4（M1/M2） | 类型面自证迁移与记账 |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | ✅ ALLOW 行 5（M3，注释级） | 防注释与加宽事实矛盾 |
| `packages/doc-runtime/test/issue-382-where-window-contract-red.test.ts` | ✅ ALLOW 行 6（新建） | 缝 1 行为契约（C/D/V/P/T/Z + F1–F6 + NC） |
| `packages/doc-runtime/test/issue-382-where-window-type-guard.test-d.ts` | ✅ ALLOW 行 7（新建） | Y1–Y4 类型契约 |
| `packages/namespace-registry/test/issue-382-lease-where-no-silent-pass.test.ts` | ✅ ALLOW 行 8（新建） | P4 条件不变式耐久形态 |
| `artifacts/sa3-issue382-*.log`（8 份） | ⚠ 非源码范围：设计 §12 P6 / SA8 A6′ 明令「记入实现票 artifacts 与 S1–S4 同列登记」；沿仓内既有 SA3 证据惯例（`artifacts/sa3-issue381-*.log`） | 实现证据，非产品代码 |
| `wiki/raw/task_issue-382_sa3_impl.md` | SA3 skill 固定产物（实现报告） | 报告 |

DENY 核对：无 DENY 路径出现在 changed set；`git diff --name-only` = 恰 5 个 ALLOW 路径（3 src + 2 迁移测试），无 ALLOW 外产品文件。

## Verification

| # | Command | Result | Evidence |
|---|---|---|---|
| V-1 红灯基线（TDD 红） | 将 3 个 src 还原到 HEAD 后：`NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck packages/doc-runtime/test/issue-382-where-window-contract-red.test.ts` | **exit 1；44 failed / 32 passed（76）**——C1–C11（除 C8 伪绿）、D1–D12、P1–P5、T4/T5、Z1–Z8、F1/F2/F4–F6、V3/V20 全在 HEAD 红（红因 = where 词表位缺席）；随后逐字节还原（`diff` 验证 identical） | `artifacts/sa3-issue382-red-contract.log` |
| V-2 红灯基线（类型面） | 同还原状态下：`npx vitest run --typecheck`（#382 行为契约 + 类型契约 + registry P4 三文件） | **exit 1；`Type Errors 3 failed`**：TS2305×1（`WhereTerm` 无导出）、TS2353×6（两面 options 无 `where`）、TS2339×4（`where` 投影缺失）、TS2344×4（`total` 钉不符）、TS2578×5（`@ts-expect-error` 尚未可判）；行为面 47 failed / 35 passed（82） | `artifacts/sa3-issue382-type-red.log` |
| V-3 红灯转绿（行为 + 类型） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck` × 11 文件（#368 契约/pins、#381、surface guard/type guard、#382 契约/type guard、#369 组合/lease/lease-surface、#382 registry P4） | **11 files / 226 tests passed；`Type Errors no errors`；exit 0（7.58s）** | `artifacts/sa3-issue382-focused-family.log` |
| V-4 受影响包 typecheck | `npx tsc -p packages/{doc-runtime,namespace-runtime,namespace-registry}/tsconfig.json --noEmit` | 三者 **exit 0** | `artifacts/sa3-issue382-package-typecheck.log` |
| V-5 仓级机械门（M5） | `pnpm typecheck`（14 个 tsc 工程） | **exit 0**（runtime.ts 零 diff 下 `total` 加宽天然 typecheck：无 cast / 无兜底） | `artifacts/sa3-issue382-root-typecheck.log` |
| V-6 仓级测试门（AC8） | `pnpm test`（`vitest run --typecheck`；基线 393 文件 / 4745 用例） | **exit 0；396 files / 4827 tests passed；`Type Errors no errors`；625.65s**（= 基线 + 本票 3 个新文件 / +82 用例）。首轮跑出 1 处红并被修复（见下），修复后复跑全绿 | `artifacts/sa3-issue382-full-test.log`（首轮红基线 `artifacts/sa3-issue382-full-test-pre-fix-gate-red.log`：`issue-382-lease-where-no-silent-pass.test.ts:114` 恒四键字面量违反 #333/#336/#364 收敛门 → 改用 `expectReadDataOkKeys`） |
| V-7 D8 变异探针 · 变异态（A6′） | 临时删除入口分支 + `total ?? 0` 软化 → 分视图敌意 options Proxy（对 W1 呈五键、对 S3 呈干净四键）经 lease 调用 | **`ok:true truncated=false keys=["t3"]`** = 静默**已过滤**四键成功面；同探针内 plain where 仍 `ok:false WINDOW_OPTIONS_INVALID`（隔离出漂移通道）；`stackDiscriminated=true ownKeysCalls=2` | `artifacts/sa3-issue382-d8-probe-mutated.log`、汇总 `artifacts/sa3-issue382-d8-probe.log` |
| V-8 D8 变异探针 · 分支在场（A6′） | 原样还原后同一调用 | **`ok:false code=WINDOW_OPTIONS_INVALID`**；`ownKeysCalls=1`（入口分支先于 S3，零 W1 重派发）；`diff` 验证 src 与还原前逐字节一致 | `artifacts/sa3-issue382-d8-probe-live.log` |
| V-9 变异编译期可见性（A6′ 第二道） | 纯删除变体 → `tsc -p packages/namespace-runtime/tsconfig.json --noEmit` | **exit 2：TS18048 + TS2345**（S6 收窄钉在场）；`?? 0` 软化变体可编译 → 证明行为级探针不可替代 | `artifacts/sa3-issue382-d8-mutation-typecheck.log` |
| V-10 结构审计 S1–S4 | S1 `git diff --stat` + sha256 + 镜像标记数；S2 changed src 集 + hunk 位点 + 新增订阅/缓存 grep；S3 无 where 基线家族；S4 分支位点/顺序/判据 + S3 白名单 | 全过（见下） | `artifacts/sa3-issue382-structural-audit.log` |

### 结构审计 S1–S4（含 SA2 R-2 增补检查位）

| # | 审计 | 实测 |
|---|---|---|
| S1 | `read.ts` 冻结面 | `git diff --stat -- packages/doc-runtime/src/read.ts` **空**；sha256 `3bf6b8b016e4066dd089f2cfd17d9c5bf3ad161ab3285c91b71298d983b1b312`（= 设计/F6 值）；`copied from read.ts@36a73bb` 标记数 10 → 10（不减） |
| S2 | 过滤落点/无新读路径 | 过滤内联在 `window.ts` 原地 `enumerateArrayCandidates`/`enumerateMapCandidates`（C/E 枚举内、S 排序前）；changed src 恰 3 文件、**新增 src 文件 0**；diff 内无 subscribe/observe/memo/cache/timer 新增；无新公共值导出、无第四读方法 |
| S3 | 无 where 分支零回归 | #381 14/14、#368 契约 47/47、pins 11/11、surface guard 6/6、#369 组合 17/17、lease 33/33 全绿；本票 T1–T3/NC1–NC3（total = 标识计数 / 序 / 条目列表 / 零物化）逐条绿 |
| S4 | 中间态 fail-closed（A2′ 增补位） | 分支在场：`window-read.ts` L168 `if (input.total === undefined) return seamWhereNotImplemented(input.path);` = `composeWindowRead`（L158）函数体第一句；**先于 S3**（`canonicalWindowBudget` 调用在其后）；判据键于 **W1 结算结果** `total === undefined`（**非** options 重读、**非** where 形状校验）；失败经本模块单源 `windowFailure`（L416，恰四键 + `safePathCopy`）；S3 白名单仍恰四键（L230 逐字节未动）；`git diff` 确认 S3/canonicalOrderBy 判据体零改动 |

## Deferred verification（非本票 SA3 职责，供 SA4/SA7 与后续缝）

- **SA6 §12.7 十四类变异矩阵**：仅执行了 SA8 A6′ 明令的 D8 变异类（含 `?? 0` 软化与纯删除两变体）；其余 13 类（ignore-where / 见 where 即拒 / 不校验 / 全量物化 / 整项深读 / 管线错序 / total 计数 / truthiness / `[[Get]]` 下钻 / 词表放宽 / readData 渗入 / 期望同源 / 软化手段）的变异击穿留待复核票，本票以 C/D/P/T/Z/V 组 + 独立预言机 + V 组伪绿登记作为对应防线。
- **缝 2 义务（ADR 0029 §5/§6，SA8 A2/A2′ DR-5/DR-11）**：lease 面 `where` 接收、`truncated` 双语义、✂ 有 where 永不装配、S3 镜像扩展「两层同步扩」——本票**未做**（非目标），中间态由 D8 分支保持响亮；缝 2 落地时须整体取代 D8 分支并在 PR #380 阶段收官前闭合。
- **位置序成本短路（Follow-up ②）**：本票以可观测等价兑现（P5/Z5），成本短路为登记演进位（触发 ~10⁵），非验收门槛。
- **`#381` T9c label「未知键」语义过时**（`where:'x'` 新因 = 非数组，断言仍同码绿）：观察项非改动项（M4 零改动纪律）。
- 真实环境/CI 验收：不属 SA3 职责。

## Deviations or blockers

- **无设计偏离、无阻塞**。`runtime.ts` 零 diff 主张经 V-5 机械门证实（无需改 runtime.ts）；S3 白名单未放宽；`read.ts` 零 diff。
- 审计期对 `window-read.ts` 施加的两处临时变异（删分支 / `?? 0`）已逐字节还原并以 `diff -q` 校验一致，临时探针测试文件 `packages/namespace-registry/test/__sa3_382_d8_probe.test.ts` 已删除（`ls` 复核零命中、`git status` 无残留）。
- 观察项（非缺陷、无动作）：`where` 非数组时 message 文案与新校验因由不同（message 非契约字段，SA6 §15-O2）；D8 分支 message 亦非契约字段。

## Suggested commit message

```
feat(#382): 窗口读 where 合取过滤与 total 值域加宽（ADR 0029 缝 1）

- doc-runtime/window.ts：两面 options 增 where?: readonly WhereTerm[]（v1 单段字面键 +
  标量闭集等值，number 须 finite）；OPT 五键白名单 + descriptor 纪律校验（零 [[Get]]、
  零 accessor 执行、trap 收编，where 形状非法收编 WINDOW_OPTIONS_INVALID）；E+W 内联过滤
  （每 child 每 term 恰一次单段原始读，未匹配零物化）；管线序 where → orderBy → n；
  成功结算 total 键恒在（无 where = 候选标识计数；有 where = undefined）
- doc-runtime/index.ts：export type { WhereTerm }（type-only，值导出面保持两枚）
- namespace-runtime/window-read.ts：compose 签名 total 加宽 + composeWindowRead 入口
  fail-closed（total === undefined ⟹ WINDOW_OPTIONS_INVALID，键于 W1 结算、先于 S3，
  缝 2 前 lease 面 where 恒响亮）；S3 判据体零改动；runtime.ts 零 diff
- 测试：新增 issue-382 行为契约（C/D/V/P/T/Z/F/NC）与类型契约（Y1–Y4）+
  registry lease where 无静默通过条件不变式；#368 头注与 public-surface 类型锁同步迁移
```

（SA3 未执行 commit/push/PR；commit message 仅供 Controller 选用。）
