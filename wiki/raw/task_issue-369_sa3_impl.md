# SA3 Implementation Report

- 任务：issue #369 W2 —— lease 公共面 `readArray` / `readMap`（ADR 0028 决策 1/3/4/6/7/9）。
- Worktree / 基线：`/home/wangjian/nomicore-fix-issue-369`，HEAD `ab6e390`（#368 W1 已合并）。
- 迭代：**iteration 1**（SA4 F-369-1 返工轮）。iteration 0 = 本票首次实现（W2 组合层 +
  lease 面 + 契约测试 + 文档）；本轮只做 `wiki/raw/task_issue-369_sa4_review.md` §10 的
  **F-369-1（MAJOR）** 修复：S6 ✂ 事实行 pathText 改为消费 `normalizeReadPath` 已验证快照
  （不再对 raw path 二次 spread），并补敌意 proxy-path 回归用例。其余实现/测试/文档/范围
  与 iteration 0 逐字节一致（本报告已原位更新为只描述当前实现与当前验证结果）。

## Inputs consumed

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-369.md`（Host brief） | 在场 | What-to-build + AC1–AC6；评论数 = 0（无 owner 条款；本轮 dispatch 复述 REST 实读为空） |
| `wiki/raw/task_issue-369_design.md`（SA1 冻结设计，F-1 修订版） | 在场 | §7.1 B-1–B-11、§7.2 B-6、§7.3 S1–S6（S6 明文「pathText 取自 normalizeReadPath 快照」）、§7.4 计数、§9 失败面、§11 ALLOW/DENY、§12 验收 |
| `wiki/raw/task_issue-369_sa2_review.md`（approve） | 在场 | F-1 呈现安全要求、N-1–N-6 观察 |
| `wiki/raw/task_issue-369_sa6_contract.md`（approve 附冻结条件） | 在场 | §12.2 用例组 W2-A/S/T/E/F + Y1、§12.6 防线、§12.8 测试路径 |
| `wiki/raw/task_issue-369_design_conflict_report.md`（clear） | 在场 | RA-1–RA-5 实现期义务 |
| **`wiki/raw/task_issue-369_sa4_review.md`（reject，唯一 MAJOR = F-369-1）** | 在场 | 本轮返工输入：§4 F-369-1 详证（可达性五跳推演）+ §10 Required change/Acceptance + §11 后续动态验证项（敌意 path 三型矩阵）+ §12 O-2 |
| `docs/adr/0028-window-read.md`、`0027-readdata-projection-text.md`、`0024`、`0016`、`CONTEXT.md` | 在场 | 规范权威（窗口读口径、投影文本文法、预算轴语义、词汇） |
| `packages/{doc-runtime,namespace-runtime,namespace-registry}/AGENTS.md`、`docs/AGENTS.md` | 在场 | 包边界（公共 API 仅经 `src/index.ts`、读不进 sequencer）、文档纪律 |
| 既有源码 + 测试（W1 `window.ts` 导航/材料化读法、readData 组合面 `normalizeReadPath`、键集守卫、收敛门、docs 同步门） | 在场 | 复用先例与回归锚 |

SA6 红灯契约**未落盘测试文件**（其 dispatch 明确零测试）；iteration 0 已按设计 §11 ALLOW 将
契约转写为两个运行期契约文件 + 一个类型层 `.test-d.ts`。本轮 dispatch 明确复述 issue #369
REST 评论实读为空 → **无 owner 条款需映射**（沿 §4 结论）。

## Existing worktree reconciliation

- 进入本轮时 worktree = **iteration 0 的未提交实现**（22 tracked 修改 + 6 新文件，SA4 已审）。
  逐条核对最新设计：保留全部符合设计的改动；仅修正 SA4 F-369-1 指出的 `window-read.ts`
  S6 pathText 通道（详见下）。
- **修正前实现事实**（F-369-1）：`windowPathText(path)` 对**实参 path 二次 spread**
  （`safePathCopy`）后逐段折叠——SA4 可达性构造（真数组 Proxy + 计数型 get trap：W1 索引读
  与 S5 spread #1 视图干净、S6 spread #2 返回 throwing-`toString` 段）可使裸异常逃出
  `runtime.readArray/readMap` → lease 原样透传 → 消费方收到 throw，违反设计 §9/§8.2
  「敌意输入零外抛」与 ADR-0008 纪律；且 spread #2 视图漂移可致 pathText 与实际读取路径不符。
- 未触碰 DENY LIST：`packages/doc-runtime/**` 零 diff、`packages/vfsl/**` 零 diff、
  `CONTEXT.md` / `docs/adr/**` / `vitest.config.ts` 零 diff（`git status` 实查）；
  `readData` / `canonicalReadOptions` / `seamReadOptionsInvalid` 行为与字节不变（本轮只给
  既有 `normalizeReadPath` 加 `export` 关键字 + JSDoc，函数体零改动）。
- 无临时探针/调试残留；`git diff --check` clean。

## Changed paths

| Path | Design section | Change |
|---|---|---|
| `packages/namespace-runtime/src/window-read.ts`（新） | §7.2/§7.3/§7.4/§8.1 | 组合层：窗口 options/结果类型（doc-runtime 单源别名）、`composeArrayWindowRead`/`composeMapWindowRead`（S3 canonical → S4 计数 → S5 锚链正文 → S6 四键结算 + ✂ 窗口事实）、`canonicalWindowBudget`、`countWindowCandidatesAtPath`（O(N) 标识枚举 + 出处标记镜像）、失败构造（接缝终态 / 计数防御位）、`foldSegment` + `safePathCopy` 镜像。**iteration 1**：S5/S6 共用单次 `normalizeReadPath` 快照（`segments`）；`anchorSchemaBody`/`windowFactsBlock`/`windowPathText` 改为只消费该已验证快照（失败面 path 回显仍走 `safePathCopy`）；模块头与 B-8 槽① JSDoc 同步 |
| `packages/namespace-runtime/src/runtime.ts` | §7.3 S1/S2、§8.1、B-11 | `NamespaceRuntime` +2 成员与 JSDoc（四键/锚口径/✂ 事实/失败面/lifecycle 顺序）；闭包方法 `readArray`/`readMap`（S1 gate → S2 W1 直通 → compose）；对象字面量 +2 键（12→14）；头注/键数措辞同步 |
| `packages/namespace-runtime/src/read-schema-projection.ts` | §7.3 S5、§11 | 抽取并导出 `projectSchemaTextBody`（无头行正文变体）；`projectReadDataSchema` 内部改走共享前奏 `resolveSchemaBody`（输出逐字节不变）；删除已内联的 `assembleProjectionText`。**iteration 1**：`normalizeReadPath` 加 `export`（函数体零改动）+ JSDoc 记 F-369-1 单快照契约 |
| `packages/namespace-runtime/src/index.ts` | §8.1、B-11 | type-only 追加四个窗口别名；头注 + #369 增量段（值导出面仍恰一键） |
| `packages/namespace-registry/src/types.ts` | §8.1、B-5 | `NamespaceLease` +2 方法（JSDoc）；四个 lease 窗口别名（= runtime 别名 \| released issue）；runtime 类型导入 +4 |
| `packages/namespace-registry/src/lease.ts` | §7.1 B-5/B-10 | 两方法（released 短路先行 + active 期 raw 引用透传）；两对 Equal 锁（结果 + options）；`LeaseTypeAssertions` +4 项 |
| `packages/namespace-registry/src/index.ts` | §8.1 | type-only 追加四个 lease 窗口别名；头注 + #369 增量段 |
| `packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts`（新） | §11、§12 | 组合层契约：能力存在性、S1 lifecycle gate（零 options 触达）、S3 canonical 三出口、S4 计数矩阵（独立预言机）、S5 锚链 oracle（含 B-6 回退与数据无关性）、E3/E4 哨兵、readData/W1 负控 |
| `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`（新） | §11、§12 | 主契约：W2-A（A1–A6）、W2-S（S1–S4）、W2-T（T1–T7 含敌意 field 名与 `\r`/`\r\n` 变体）、W2-E（E1–E4）、W2-F（F1–F6）、NC1/NC3/NC4。**iteration 1**：+ `hostilePathProxy`/`w1IterationReads`/`captureArrayRead` 装置 + **T8**（S6 二次迭代协议读投毒 → 零外抛、事实行取单快照）+ **T9**（快照不可验证 → 诚实 null、零外抛） |
| `packages/namespace-registry/test/issue-369-window-read-fixture.ts`（新） | §11（fixture 允许项） | 共享 fixture：SA6 §12.3 最小 schema + 数据、`probe` 计数矩阵 raw 数据、poison 变体、DocHandle/Registry 装配助手 |
| `packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts`（新） | §8.1、§12 Y1 | 类型层锁：签名（第二参必填）、options 单源 Equal、结果别名 Equal、成功成员 keyof 恰四键、负例（缺 options / 面词表外排序项） |
| `packages/namespace-runtime/test/runtime-close-lifecycle.test.ts` | B-11 | 键集 12→14 |
| `packages/namespace-runtime/test/runtime-phase5-reset-fence-r2.test.ts` | B-11 | 键集 12→14 |
| `packages/namespace-runtime/test/runtime-registry-internal-seam.test.ts` | B-11 | 键集 12→14 |
| `packages/namespace-registry/test/registry-open.test.ts` | B-11 | lease 键集 13→15（标题措辞同步）；`makeRuntime` 替身 +2 成员 |
| `packages/namespace-registry/test/registry-data-interface.test-d.ts` | §10 类型面 | +窗口方法类型锁（正例 + `@ts-expect-error` 负例） |
| `packages/namespace-runtime/test/runtime-data-interface.test-d.ts` | §10 类型面 | 同上（runtime 面） |
| `.agents/skills/nomicore/typed-access.md` | §11 文档面、AC6 | 「Window reads」段：四键面、条目身份回溯、元素口径（含封闭对象容器口径 + depth 计量披露）、✂ 窗口事实、三失败码、与预算的分工句；ADR 0027/0028 链接 |
| `docs/integration/cordis-plugin-hosting.md` | §11 文档面、AC6 | 「窗口读（readArray / readMap，ADR 0028）」小节：示例 + 四键 + 元素口径 + ✂ 样张 + 三码 + 分工句 |

### ALLOW 之外的机械同步（iteration 0 范围偏差，如实保留登记）

接口扩张（B-11：`NamespaceRuntime` 12→14、`NamespaceLease` 13→15）使**设计 §10 未枚举**的
既有消费方替身编译失败（`pnpm typecheck` / `pnpm test --typecheck` 会红）。这些改动均为
**替身补成员**（零断言语义变化、零新增行为），逐条列于下表；SA4 §6 已复核为「必要、最小、
语义惰性」，本轮零改动。除此外未触碰任何 ALLOW 外路径。

| Path | 必要性 | Change |
|---|---|---|
| `packages/ws-replication/src/testing.ts` | `decorateLease` 逐成员绑定租赁能力；缺成员 → **`pnpm typecheck` 红**（ws-replication tsconfig 含 src） | 绑定 `readArray` / `readMap`（与既有 `readData` 同款 `bind`） |
| `packages/namespace-registry/test/registry-idle.test.ts` | `class ObservableRuntime implements NamespaceRuntime` | +2 方法（恒返回 `PATH_NOT_ALLOWED` 替身失败） |
| `packages/namespace-registry/test/registry-sa7-hostile.test.ts` | 同上 | 同上 |
| `packages/namespace-registry/test/registry-sa7-rev1.test.ts` | 同上 | 同上 |
| `packages/namespace-registry/test/registry-shutdown.test.ts` | 同上 | 同上 |
| `packages/namespace-registry/test/registry-sa7-concurrency.test.ts` | `class CountingRuntime implements NamespaceRuntime` | 同上 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test.ts` | `makeRecordingRuntime` 14 键字面量 | 同上 |
| `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts` | 同上 | 同上 |

## SA4 Finding 落实

| Finding ID | Implementation | Result |
|---|---|---|
| **F-369-1（MAJOR）**：S6 ✂ 窗口事实装配的 pathText 槽对敌意 path 有未收编外抛通道（`windowPathText` 二次 spread raw path + `foldSegment` 的 `String(seg)` 无守卫）；且 spread #2 视图漂移可使 pathText 与实际读取路径不符 | **修复**（`window-read.ts` §7.3 S6）：S5/S6 前置**单次** `const segments = normalizeReadPath(path)`（已验证普通数组 + 段域 `string|number` + 迭代纯度校验；敌意/异态 → null）；`anchorSchemaBody(state, segments, …)` 只由快照构造锚路径；`windowFactsBlock(segments, …)`/`windowPathText(segments)` **只消费快照**（类型收窄为 `readonly (string | number)[]`，`String(seg)` 对已校验段全域收敛 → 结构上零外抛）；快照缺席 ⟹ 正文 null ⟹ ✂ 块不装配（**诚实 null**，ADR-0027 null 单义；绝不用不可验证 raw path 造事实行）；`normalizeReadPath` 自 `read-schema-projection.ts` 导出（函数体零改动，readData 字节不变）。失败面 path 回显仍走 `safePathCopy`（不动已批准行为） | **已落实**：设计 §7.3 S6「pathText …取自 …normalizeReadPath 快照」逐字兑现；raw path 在组合层恰被消费一次（T8 以 `probe.iterations() === w1Reads + 1` 锚定）；冻结结果联合/四键/no-throw 语义零变化（48 既有用例全绿） |
| SA4 §10 Acceptance（新用例：stateful get trap + throwing `toString` 段 + truncated:true + 可解析 schema → 结果联合成员（或诚实 null），断言不抛） | **T8**（主型，`issue-369-window-read-lease-contract-red.test.ts`）：真数组 Proxy + 计数型 get trap；允许额度 = W1（冻结面，`w1IterationReads` 直调实测）自身迭代协议读次数 + 1（组合层唯一快照），第 (W1+2) 次迭代协议读返回**投毒迭代器**（throwing-`toString` 段）→ 修复后永不触达；断言 ①零裸抛（try/catch 捕获并显式断言 `escaped === undefined`）②成功恒四键 ③`value` ≡ 直调 W1 ④`truncated:true` ⑤✂ 事实块 Byte 级 `endsWith('\n\n✂ 截断事实：\n- workRecords · 窗口 · 基 index asc · kept 2/total 3\n')` 描述**实际读取路径** ⑥恰一行事实行 ⑦组合层对 raw path 的迭代协议读 = W1 + 1。**T9**（诚实 null 型）：额度 = W1 自身，快照迭代协议读即投毒 → 迭代器非标准 → 快照收敛 null；断言零裸抛、`ok:true`、`schema:null`、值通道与 `truncated:true` 保持 | **已落实**：修复前 T8 **红**（`1 failed | 1 passed`，逐字 `敌意 path 不得使 lease 公共面裸抛（F-369-1）：Error: probe: hostile path segment（F-369-1 二次 spread 投毒）`——F-369-1 原始症状复现）；修复后 T8/T9 双绿；SA4 §11 三型矩阵覆盖：**段 throwing-`toString` + 双 spread 漂移**（T8）、**迭代器非标准/不可验证**（T9） |
| SA4 §12 O-2（F-369-1 的呈现漂移面随修复一并消除，修复前不单独计分） | pathText 与锚链共用同一快照（同一视图），二次 raw 读消失 | **已落实**：T8 第 ⑤⑥ 断言证明事实行取自读取路径快照 |

## SA2 Finding落实（iteration 0，保持）

| Finding ID | Implementation | Result |
|---|---|---|
| **F-1（MAJOR）**：B-8 基槽缺行注入折叠——敌意 field 名可伪造 ✂ 头/事实行 | `window-read.ts` §S6：`windowFactsBlock` 对四插值槽确定性渲染，`basis` 槽为 `field:` + `foldSegment(field)`（`replace(/\r\n|\n|\r/g,' ').trim()`——`read-schema-projection.ts` foldSegment 同款，带出处标记 N-4）；不变式「块恒头行 + 恰一行事实行」；折叠只在装配点（canonical 归一化项与 S2 值通道保持 raw） | **已落实**：T5 敌意载荷（`\n` + `✂ 截断事实：` + 行首 `- `）→ 单 ✂ 行、无伪造行、基槽呈折叠形态、Byte 级 `endsWith` 常量；值通道非污染以「`field:'priority'` 对照调用给出不同窗口」锚定；T6 `\r`/`\r\n` 变体直击折叠正则另两分支（N-3） |
| N-1（RA-3 计数镜像防线） | `countWindowCandidatesAtPath` 以出处标记镜像 W1 导航/分类（`copied from window.ts@ab6e390`、`carrier.ts@ab6e390`）；契约测试以**独立预言机**（Yjs/native 直数）对账 9 例边界矩阵 | **已落实**（S4 矩阵 + T7 边界） |
| N-2（R1 封闭对象 depth 披露 = AC6 属性） | 两文档窗口读段明示「封闭对象形 schema = 容器口径 + depth 自容器起算 + `depth ≥ 1` 得完整字段口径」；契约 S4 以 oracle 锚定该口径 | **已落实** |
| N-3（`\r`/`\r\n` 变体） | T6 两变体用例 | **已落实** |
| N-4（`foldSegment` 出处标记） | `window-read.ts` 折叠助手带 `copied from read-schema-projection.ts@ab6e390 (foldSegment)` | **已落实** |
| N-5/N-6（措辞/预防性预留） | 无需实现动作；N-6 经实查确认（exports-audit 零 diff 仍绿） | 已确认 |

## File scope check

| Changed path | ALLOW entry | Purpose |
|---|---|---|
| `packages/namespace-runtime/src/window-read.ts` | 有（新） | 组合层主体（iteration 1：S5/S6 单快照修正） |
| `packages/namespace-runtime/src/runtime.ts` | 有 | 接口 +2 成员 / 闭包方法 / 14 键 |
| `packages/namespace-runtime/src/read-schema-projection.ts` | 有 | `projectSchemaTextBody` 抽取 +（iteration 1）`normalizeReadPath` 导出（函数体零改动） |
| `packages/namespace-runtime/src/index.ts` | 有 | type-only 四别名 |
| `packages/namespace-registry/src/types.ts` | 有 | lease 两方法 + 四别名 |
| `packages/namespace-registry/src/lease.ts` | 有 | 两方法 + Equal 锁 |
| `packages/namespace-registry/src/index.ts` | 有 | type-only 四别名 |
| `packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts` | 有（新） | 组合层契约 |
| `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts` | 有（新） | 主契约（含敌意 field 用例；iteration 1：+T8/T9 敌意 path 用例与装置） |
| `packages/namespace-registry/test/issue-369-window-read-fixture.ts` | 有（新，§11 允许的同目录 fixture） | 共享夹具 |
| `packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts` | 有（新） | 类型层契约 Y1 |
| `packages/namespace-runtime/test/runtime-close-lifecycle.test.ts` | 有 | 键集 12→14 |
| `packages/namespace-runtime/test/runtime-phase5-reset-fence-r2.test.ts` | 有 | 键集 12→14 |
| `packages/namespace-runtime/test/runtime-registry-internal-seam.test.ts` | 有 | 键集 12→14 |
| `packages/namespace-registry/test/registry-open.test.ts` | 有 | lease 键集 13→15（+替身两成员） |
| `packages/namespace-registry/test/registry-data-interface.test-d.ts` | 有 | 类型面 +2 |
| `packages/namespace-runtime/test/runtime-data-interface.test-d.ts` | 有 | 类型面 +2 |
| `.agents/skills/nomicore/typed-access.md` | 有 | 窗口读消费段 + 分工句 |
| `docs/integration/cordis-plugin-hosting.md` | 有 | 窗口读消费段（示例版） |
| `packages/ws-replication/src/testing.ts` | **无**（iteration 0 范围偏差；SA4 §6 复核为必要/最小/语义安全） | `decorateLease` 补两成员绑定（否则 `pnpm typecheck` 红） |
| `packages/namespace-registry/test/registry-idle.test.ts` | **无**（同上） | 替身类补两成员 |
| `packages/namespace-registry/test/registry-sa7-hostile.test.ts` | **无**（同上） | 同上 |
| `packages/namespace-registry/test/registry-sa7-rev1.test.ts` | **无**（同上） | 同上 |
| `packages/namespace-registry/test/registry-shutdown.test.ts` | **无**（同上） | 同上 |
| `packages/namespace-registry/test/registry-sa7-concurrency.test.ts` | **无**（同上） | 同上 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test.ts` | **无**（同上） | 替身字面量补两成员 |
| `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts` | **无**（同上） | 同上 |
| `artifacts/sa3-issue369-*.log` | 无（诊断产物，非源码/测试） | 验证证据日志 |
| `wiki/raw/task_issue-369_sa3_impl.md` | 无（固定报告路径） | 本报告 |

## Verification

| Command | Result | Evidence |
|---|---|---|
| 红灯（F-369-1 新用例，修复前）：`npx vitest run packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts --typecheck.enabled=false -t '敌意 path'` | **红**：`Tests 1 failed | 1 passed | 31 skipped`；失败 = T8，逐字 `敌意 path 不得使 lease 公共面裸抛（F-369-1）：Error: probe: hostile path segment（F-369-1 二次 spread 投毒）`——**F-369-1 原始症状真实复现**（裸异常逃出 lease 公共面）；T9（诚实 null 型）在修复前亦绿（该型非外抛面，作 no-throw 守卫） | `artifacts/sa3-issue369-f369-1-red.log` |
| 绿灯（修复后，同命令） | **绿**：`2 passed | 31 skipped` | `artifacts/sa3-issue369-f369-1-red-tests-green.log` |
| 红灯契约全量（两文件）：`npx vitest run <lease-contract> <composition> --typecheck.enabled=false` | **绿**：`2 files / 50 tests passed`（48 既有用例 + T8/T9，零回归、零 skip/only） | `artifacts/sa3-issue369-f369-1-contract-green.log` |
| 受影响包运行期回归：`npx vitest run packages/doc-runtime packages/namespace-runtime packages/namespace-registry packages/ws-replication --typecheck.enabled=false` | **绿**：`196 files / 2210 tests passed`，exit 0（iteration 0 为 2208 → +2 新用例；含 W1 冻结面、readData 字节锚、键集/收敛门/docs 门） | `artifacts/sa3-issue369-f369-1-affected-packages.log` |
| 测试树类型检查：`npx tsc -p tsconfig.typecheck.json --noEmit` | **exit 0**（含全部既有测试树与新增测试） | `artifacts/sa3-issue369-f369-1-typecheck-tree.log` |
| 根类型检查：`pnpm typecheck`（14 个包 tsconfig） | **exit 0** | `artifacts/sa3-issue369-f369-1-typecheck-packages.log` |
| CI 等价类型检查：`npx vitest run --typecheck.only --passWithNoTests=false` | **绿**：`38 files / 231 tests passed；Type Errors: no errors` | `artifacts/sa3-issue369-f369-1-typecheck-tests.log` |
| 形状断言收敛门 + docs 同步门：`npx vitest run readdata-shape-assertion-consolidation-gate readdata-docs-adr0016-sync-control --typecheck.enabled=false` | **绿**：`59 tests passed`（family A/B 归零；文档旧词汇/opt-in 扫描零命中） | `artifacts/sa3-issue369-f369-1-docs-shape-gates.log` |
| 静态生成/check：`pnpm generate` / `pnpm schema:check` | **不适用**（本票零 schema/生成物改动；设计未指定生成命令） | — |
| `git diff --check` | clean（零空白/冲突标记） | — |

修复前后对照一句话：**同一 T8 用例修复前裸抛逃逸（红）→ 修复后零外抛 + 事实行取自读取路径
快照（绿）**；其余 48 个既有契约用例、四包 2208 个既有用例、类型面与两道门零回归。

## Deferred verification

- **根 `pnpm test`（388+ 文件全量，含 `--typecheck`）**：SA3 职责边界外的全仓回归
  （skill：SA3 只跑红灯契约 + 受影响包 typecheck + 指定静态 check）。已用 CI 等价
  `vitest --typecheck.only` + 四包运行期回归覆盖全部被改动路径；**建议 SA7 以 `pnpm test` 复核**
  （基线 388 文件 / 4668 用例）。
- **`packages/namespace-diagnostic-log` / `apps/yjs-server` / `domains/**`**：零 diff、零引用面
  （仅消费公共 API），未单独复跑；由 SA7 全量覆盖。
- **F-369-1 修复后的敌意 path 矩阵**：SA4 §11 点名的三型已由 T8/T9 覆盖（段 throwing-`toString`
  + 双 spread 漂移 = T8；迭代器非标准 = T9）；另 SA4 §11「`{}` 预算 ≡ 无预算渲染逐字节」探针
  属 SA7 动态验证项，未复跑。
- **发布版本 bump 评估**（ADR-0027 §5 先例）：属发布流程，非 SA3 义务。

## Deviations or blockers

1. **`normalizeReadPath` 由模块私有转为模块级导出**（`read-schema-projection.ts`，包内模块、
   不经 `src/index.ts`）：这是 F-369-1 修复的最小实现路径——设计 §7.3 S6 明文要求 pathText
   取自「normalizeReadPath 快照」，而该守卫为 readData 单源实现（不复制第二份守卫、不新增
   平行机制）。函数体零改动、readData 输出逐字节不变（既有快照/字节锚测试全绿）；设计 §11
   对该文件的 ALLOW 条目为「抽取并导出 `projectSchemaTextBody`」，本导出属同文件同目的
   （窗口读 S5/S6 共享件）的最小延伸，**请求 SA4 复核该导出的必要性与最小性**。
2. **ALLOW LIST 未枚举 8 个既有消费方替身**（iteration 0 范围偏差，SA4 §6 已复核为必要/最小/
   语义惰性；本轮零改动）：见「Changed paths → ALLOW 之外的机械同步」表。
3. **SA6 未落盘红灯测试文件**：iteration 0 已按设计 §11 ALLOW 转写为两个运行期契约文件 +
   一个类型层文件，并保留红灯证据；本轮新增用例同为行为断言，未弱化任何 SA6 语义断言
   （三码/四键/条目列表/✂ 事实/oracle/哨兵/透传逐条保持）。
4. **无未解决 blocker**：设计可实施、ALLOW/DENY 边界除上述枚举遗漏外明确；SA4 F-369-1 的
   Required change 与设计 §7.3 S6 原文一致（实现偏离而非设计缺口），无需设计轮回流，
   不触发新的 ADR 冲突复查（`requiresConflictRecheck: false`——修复系设计既定快照纪律兑现，
   不新增公共 API / schema / 失败语义面；沿 SA4 §2 结论）。

### 实现口径澄清（供 SA4/SA7 对照，非偏离）

- **✂ 块拼装字节**：渲染器正文恒以恰一个 `\n` 收尾，故事实块装配为「剥尾换行 → `\n\n` 接块 →
  结尾补恰一个 `\n`」，与渲染器 `blocks.join('\n\n') + '\n'` 同规则（同一字节结果：
  `正文\n\n✂ 截断事实：\n- …\n`）。SA6 §12.6-2 的 Byte 冻结按此落为测试内单点常量。
- **canonical 预算空轴**：四键空间全缺席/全剥离时 canonical 预算为 `{}`；经探针实测
  `readData(锚, {})` 与无预算读**逐字节相同**（渲染器零标记、头行同形），故 AC2 的
  「同预算」oracle 对 `{n}` 类调用取无预算读亦逐字节成立（测试 S 组两侧剥离对账）。
- **接缝终态 message**：含字面「视图不稳定」语义（B-8/§7.3 S3 措辞），并按 SA6「不锁 message」
  纪律仅作 `toContain` 弱断言；形状以 `WindowReadFailure` 类型注解锁死。
- **F-369-1 修复的 `schema:null` 语义**：快照不可验证（敌意/异态 path）时窗口面返回
  `ok:true` + `schema:null` + `truncated` 诚实布尔——沿设计 §7.2 冻结规则 2（「敌意 path」列入
  两锚皆不可解析 → `schema:null`）与 ADR-0027 null 单义；锚失败不构成读失败（值通道已成功）。
  SA4 §10 给出的两个可接受出口中取「诚实 null」，不新增失败码/防御位（避免扩张失败面）。
- **F-369-1 测试的参照系**：T8/T9 的投毒触发点以**直调 W1 冻结面**实测的迭代协议读次数为
  参照（`w1IterationReads`），不依赖组合层自身计数——因此断言「组合层对 raw path 的迭代协议
  读 = W1 自身 + 1」是行为面不变量（第二次 spread 必然使其 > +1，并触发投毒）。

## Suggested commit message

```
fix(#369): W2 F-369-1 返工——✂ 事实行 pathText 取 normalizeReadPath 单快照（敌意 path 零外抛）

- namespace-runtime：window-read.ts S5/S6 共用单次 normalizeReadPath 快照（锚链与 pathText
  同源，绝不对实参 path 二次 spread；快照缺席 → 诚实 schema:null）；read-schema-projection.ts
  导出既有 normalizeReadPath（函数体零改动，readData 字节不变）
- 契约测试：T8 敌意 path（Proxy + 计数型 get trap + throwing-toString 段：零外抛、事实行取自
  读取路径快照、raw path 迭代协议读恰 W1+1）+ T9（快照不可验证 → 诚实 null、零外抛）
- 修复前 T8 红（裸抛逃逸，F-369-1 原始症状）；修复后 50/50 契约 + 四包 2210 用例 + 类型面全绿
```

## 收尾核对

- `git diff --check`：clean（零空白/冲突标记）。
- 临时诊断：无残留探针/调试文件；仅 `artifacts/sa3-issue369-f369-1-*.log` 证据日志。
- DENY LIST 核对：`packages/doc-runtime/**`、`packages/vfsl/**`、`CONTEXT.md`、`docs/adr/**`、
  `vitest.config.ts`、wire/持久化/诊断包均零 diff（`git status` 实查）；`readData` /
  `canonicalReadOptions` / `seamReadOptionsInvalid` 行为与输出字节不变。
- 零 `skip`/`only`/`todo`、零生产 env override、零静默 fallback；零 value-export 面变化
  （runtime 值导出仍恰 `RuntimeWriteFatalError`）。
- iteration 1 增量改动仅 3 个 ALLOW 路径：`window-read.ts`（S6 快照化）、
  `read-schema-projection.ts`（`normalizeReadPath` 导出）、`issue-369-window-read-lease-contract-red.test.ts`
  （T8/T9 + 装置）；其余文件与 iteration 0 逐字节相同。
