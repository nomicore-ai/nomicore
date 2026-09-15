# SA9 Standards Review — issue #383：[ADR 0029] P3 组合面与 lease 类型（缝 2：runtime + registry）

- 被审对象：最终提交 diff `de2ff55571e3d91a3b1bde3a761154c2fade6242`（PR #380 head，dispatch 确认基线新鲜）→ `3466571ae3ad7c4a00a59413e5d36268fb3d3da9`（`feat(runtime): support filtered window reads`；父提交已实测 = `de2ff55`，单提交）。
- 审查人：SA9（mabf-sa9，dispatch `sa-1c4766a9-0692-4be5-a4bb-aa35b8f9895e`，standards-review iteration 0）。
- 审查日期：2026-09-16。
- 审查方式：纯静态——最终 diff 全文核读（2 生产文件 / 4 文档 / 5 新测试·fixture / 11 wiki 证据件）+ 只读 git/grep 结构审计；不运行测试、不启动服务、不修改任何代码/设计/测试（本报告为唯一产物）。
- Owner Issue 评论：REST 快照 `[]`——无 Owner 评论、无 override 权威在场。
- 审查范围声明：只判断实现是否符合仓库 AGENTS/ADR/模块责任/架构惯例/单一事实源/生命周期对称/文件范围/测试质量标准；Issue 需求是否完整实现归 SA10，不在本报告裁决。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-383.md`（简报 AC1–AC8；评论空） | 已读 |
| `wiki/raw/task_issue-383_design.md`（SA1 iteration 1，SA2 approve） | 已读（§5.1–§5.6、§7 ALLOW/DENY、§8、§14） |
| `wiki/raw/task_issue-383_sa2_review.md`（approve；F-383-S2-1 消解 + 观察 1–5） | 已读 |
| `wiki/raw/task_issue-383_sa3_impl.md`（实现报告 + 验证证据 + 偏差登记 ×3） | 已读 |
| `wiki/raw/task_issue-383_sa4_review.md`（approve；MINOR ×3） | 已读 |
| `wiki/raw/task_issue-383_sa7_report.md`（approve；38 探针检查 + 全仓复跑逐位确认） | 已读 |
| `wiki/raw/task_issue-383_conflict_report.md`（前置门禁 clear；R1–R16/F1–F11/A1–A6）与 `..._implementation_conflict_report.md`（实现复查 clear；I1–I16；`requiresConflictRecheck: false`） | 已读 |
| `wiki/raw/task_issue-383_sa6_contract.md`（approve；B-1–B-15、用例组、M1–M7、P1–P6） | 已读 |
| 规范面：根 `AGENTS.md`、`packages/namespace-runtime/AGENTS.md`、`packages/namespace-registry/AGENTS.md`、`packages/doc-runtime/AGENTS.md`、`docs/AGENTS.md`（经 SA2/SA8 引述核验）、`docs/adr/0029` §1–§8、`CONTEXT.md` L61–67 | 已读/已核 |
| 最终 diff 全文 + W1 权威源码 `packages/doc-runtime/src/window.ts`（`validateWindowOptions` L292–353、`validateWhere` L362–404、`validateWhereTerm` L407–460、`validateWhereEquals` L463–474、`WHERE_TERM_LIMIT` L74） | 已逐行比对 |

## 2. Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。4 条 MINOR 观察（§11）不阻断。

最终交付忠实落实获批设计（iteration 1）与全部上游约束：S6 双语义单源结算 + ✂ 结构性永不装配、S3 五键白名单 + `canonicalWhere` 判据与 W1 逐判据零漂移（本审查独立逐行比对）、registry/doc-runtime/公共导出面零 diff、四文档对齐零行为发明、文件范围与 ALLOW/DENY 完全一致、测试先例真实可触发且红绿诚实、模块验证门（根 `pnpm typecheck` + `pnpm test`）经 SA3 自报与 SA7 独立复跑双重绿证。

## 3. 仓库 AGENTS / 模块责任

| 标准 | 要求 | 实现实测 | 裁决 |
|---|---|---|---|
| 根 AGENTS「Module guidance」 | 改动前遵最近嵌套 AGENTS 的契约边界与验证门 | runtime/registry/doc-runtime 三模块边界全部保持（下三行）；证据链完整 | 符合 |
| namespace-runtime AGENTS | 读取留 sequencer 外；公共 API 只暴露 detached 投影；runtime 契约变更须跑根 `pnpm typecheck` + `pnpm test` | 组合层纯同步读、零 sequencer、零状态写（`runtime.ts` diff 仅 doc 注释，S1/S2 编排区间逐行核对零行为改动）；无新 API、无裸 runtime/doc 泄漏（lease 测试 `assertNoRuntimeLeak` 断言）；SA3 `pnpm typecheck` exit 0 + `pnpm test` 400 files/4903 tests exit 0，SA7 独立复跑逐位一致（C4/C5） | 符合 |
| namespace-registry AGENTS | 公共 API 只经 `src/index.ts`；敌意/测试控件走显式 testing 面 | `packages/namespace-registry/src/**` 零 diff（实测 `git diff --stat` 为空）；fixture 经 `@nomicore/namespace-registry/testing` 的 `createNamespaceRegistryForTesting`/`createRegistryTestScheduler` 装配，未污染生产面 | 符合 |
| doc-runtime AGENTS | 公共 API 只经 `src/index.ts` 且守卫记账；读 schema 无关 | `packages/doc-runtime/src/**` 零 diff（F9 冻结面实测为空）；守卫测试零改动 | 符合 |
| 根 AGENTS「Typed Namespace writes — mandatory」 | 窗口读签名句/截断语义陈述须与实现一致（该节本身是本票文档对齐对象） | 签名补 `where?`、truncated 双语义限定、指向 CONTEXT.md「过滤窗口」词条——措辞与 ADR 0029 §5/词条逐点一致，零行为发明 | 符合 |

## 4. ADR 与规范一致性（标准维度复核；冲突裁决归 SA8，本审查独立抽查其关键闭合项）

- **ADR 0029 §1（options 词表加法；无第四读方法；readData 不动）**：`where` 仅为 options 成员；`window-read.ts` 仍只服务 `composeArrayWindowRead`/`composeMapWindowRead`；`packages/doc-runtime/src/read.ts` 不在 diff；L5/N6 行为锚 `READ_OPTIONS_INVALID` 保持。✓
- **ADR 0029 §5（双语义；✂ 有 where 永不装配；无 where 逐字节）**：`window-read.ts` L195–210——`truncated = total === undefined ? kept === canonical.n : kept < total`；`appendWindowFacts` 仅出现在 `total !== undefined` 分支（结构性排除，非布尔开关）；无 `total ?? 0`、无 `kept < undefined` 通道（grep 实测零命中）；无 where 分支表达式与旧代码逐项等价。✓
- **ADR 0029 §6（两层同步扩；S3 是镜像非第三权威）**：`canonicalWhere`/`canonicalWhereTerm`/`isScalarEquals` 与 W1 `validateWhere`/`validateWhereTerm`/`validateWhereEquals` **逐判据一致**（本审查独立比对：W-4 `Array.isArray`、W-5 length 经 own data descriptor 非负整数门、非空、≤16 同值具名常量、W-6 逐下标 descriptor 空洞/accessor 拒、W-7 元素值闭集（try 外无抛点，与 W1 同构）、W-8 plain 原型链、W-9 恰 `field`/`equals`、descriptor 缺失 ≡ 非 own `continue`、W-12 两键必填、W-10 field 恰 string、W-11 标量闭集 + `Number.isFinite` 禁 truthiness、trap 双层 try 收编）；镜像只返回布尔、不产出归一化值、不做谓词求值；两出口（出口① W1 失败透传 / 出口② `seamWindowOptionsInvalid`）复用零新码。顶层 options 判据（宿主/键集/present-undefined 剥离/轴值/必填/定序 键循环→n→orderBy→where）与 W1 `validateWindowOptions` 逐字节同判据。✓
- **ADR 0029 §2/§4（v1 词表封闭；管线 where→orderBy→n）**：镜像无任何扩词表通道；组合层零筛选/零排序/零计数/零重物化（`entries`/`total` 皆 W1 产物直通）。✓
- **ADR 0028 §7/§9、ADR 0027 §1、ADR 0008 L123、ADR 0009、ADR 0024 决策 6（冻结面）**：恒四键构造原样；`WindowFailureCode` 四枚零 diff；S1 gate / released 短路 / W1 失败透传区间零行为改动；registry raw 直传零 diff。✓
- **R16 中间态清账**：`seamWhereNotImplemented` 函数与入口分支整体删除，全仓 `grep`（packages/）零命中；无缝 1 严格断言残留测试。✓

## 5. 单一事实源

| Fact | Authoritative source | Derived state | 漂移风险评估 |
|---|---|---|---|
| where 在场判据 | W1 结算 `total === undefined`（B-8 单源） | S6 唯一分支判据；绝不重读 options | 低：S1 交替视图用例 + SA7 探针 P11（视图②隐藏 where 仍按 W1 过滤结算、passes=2/getCalls=0）行为锁定 |
| 过滤/计数/排序语义 | W1（doc-runtime） | 组合层零镜像求值 | 低：D5/S3 毒埋用例 + 探针 P25c 击穿任何重走 |
| `WHERE_TERM_LIMIT = 16` | doc-runtime 模块私有常量（不导出——导出即违 F9） | runtime 侧具名模块私有常量 + 出处注释镜像 | 低（设计明选并登记的可漂移面）：Z9「恰 16 合法 / 17 非法」行为锚 + 结构审计；与 doc-runtime 形态对称、单点定位 |
| options 类型面 | doc-runtime `ReadArrayWindowOptions`/`ReadMapWindowOptions`/`WhereTerm` | lease → runtime → doc-runtime 单源别名链 | 低：两个 test-d 的 Equal 锁（Y1/Y4）编译期钉死；零复制第二份 |
| 截断双语义措辞 | CONTEXT.md「过滤窗口」词条 + ADR 0029 §5 | 四文档补注（措辞限定） | 低：全仓 `kept < total` 文档面（排除 wiki//adr//CONTEXT）实测恰 4 处命中且全部带 where 限定；`SKILL.md` gloss 只提能力不陈述语义（link-not-copy）；`app-data-access-skill.md` 零 diff（设计 §5.6 显式登记，其深水区指针自动继承上游修正） |

## 6. 生命周期对称性

| Start/acquire | Stop/release | 实测 | 裁决 |
|---|---|---|---|
| S1 lifecycle gate（closing/closed → `RUNTIME_READ_DISABLED` 四键、零 options 读取） | 不动 | `runtime.ts` S1 区间 diff 仅注释；C1–C3 trapCounting 断言停接纳期 options 触达 === 0；SA7 探针 P21/P22（closed/closing 在途）稳定同码 | 符合（AC7 停接纳不豁免） |
| lease released 短路（`NAMESPACE_LEASE_RELEASED` 三键、先于透传） | 不动 | `lease.ts` 零 diff；L2/C4 断言 released 期 options 触达 === 0；探针 P23 | 符合 |
| 测试资源获取（fixture 每用例独立 runtime/lease/pair） | runtime 逐用例 `close()`；lease `release()`（部分含 `registry.shutdown()`） | 清理形态与 #369 lease 先例同款（release-only 先例已核实 `issue-369-window-read-lease-contract-red.test.ts` L753）；test scheduler + manual clock 无真实定时器；探针收尾复核无残留、`git status` 干净 | 符合（MINOR 观察 2 登记更严形态可选） |

## 7. 文件范围（ALLOW/DENY 对最终 diff 实测）

| 类别 | 实测 |
|---|---|
| ALLOW 命中 | `window-read.ts`（四项预期改动全部在场：删缝 1 分支与 `seamWhereNotImplemented`、五键白名单 + `canonicalWhere` 镜像 + 具名哨兵常量、ok 分支携 `n`、S6 双语义 + 头注/类型注释同步）；`runtime.ts`（仅注释，ALLOW ②可选项）；`AGENTS.md`/`typed-access.md`/`cordis-plugin-hosting.md`/`SKILL.md`（§5.6 四行）；5 个 `issue-383-*` 新测试/fixture（路径与 SA6 P1–P5 逐一对应） |
| DENY 实测（全部零 diff） | `packages/doc-runtime/src/**`、`packages/namespace-registry/src/**`、`packages/namespace-runtime/src/index.ts`、`CONTEXT.md`、`docs/adr/**`、`docs/integration/app-data-access-skill.md`、既有 #369/#382 测试与 fixture、`runtime-data-interface.test-d.ts`/`registry-data-interface.test-d.ts`/`helpers/readdata-ok-shape.ts`、公共面守卫测试、`vitest.config.ts`/`tsconfig*.json`/各 `package.json` |
| 越权改形核查 | `CanonicalWindowBudget` ok 分支扩 `{ ok, budget, term, n }`——设计 §5.1/ALLOW ①② 明选点名的承载改形（SA2 观察 1 收编），模块私有类型未导出、不上公共面；非越权 |
| wiki 证据件 | 11 份 `wiki/raw/task_issue-383*` + `task_383_dispatch.md` 随提交入仓——仓内既有先例（`4394238 docs(evidence): record issue 382 delivery reviews`、`61e1b84` 等），属 Host 证据面，非生产/测试范围问题 |
| 卫生 | `git diff --check` 干净；工作树 `git status --porcelain` 为空；无探针/临时文件残留（`registry-sa7-*.test.ts` 系 `d925e22` 早前已跟踪文件，非本轮产物）；提交父 = `de2ff55` 实测吻合 dispatch 基线 |

## 8. 架构惯例与平行机制

- **相似能力对照**：新 fixture 逐件同构 #369 fixture（`FilteredStubPersistence`/`FilteredStubHandle`/`manualClock`/`deterministicRandomBytes`/schema-ready 轮询；跨包 import `../../namespace-runtime/src/runtime.js` 与 #369 fixture L37 同款——已核实）；新组合/lease/test-d 三件套与 #369 家族同 helper 同形态（`expectReadDataOkKeys` 集中化成功形状，收敛门作用域覆盖）。✓
- **平行机制检查**：`canonicalWhere` 非第二套校验权威——只答「视图与 W1 判据是否一致」，分歧必落既有两出口响亮处置（与 #369 `canonicalOrderBy` 同族的既定镜像形态，SA8 A2 明选）；新 fixture 独立成文件保 #369 fixture 零漂移（设计明选），无重复造轮子。✓
- **公共面纪律**：三包 `src/index.ts` 零 diff ⟹ 值导出键集不变 ⟹ 守卫测试零改动（M6 零变化路径）；`WhereTerm` 不具名再导出由 Y5 双侧 `@ts-expect-error`（TS2694）锁定——未来擅自再导出会使 typecheck 假红，fail-closed。✓

## 9. 测试质量标准

| 维度 | 实测 |
|---|---|
| 采集与先例 | 5 文件按 `issue-383-*` 命名自动采集（fixture 非 `.test.ts` 不收集）；#369 组合面家族 + runtime/lease test-d + registry 内部缝先例齐备（AC8） |
| 断言纪律 | 零 skip/only/todo/env override（grep 实测）；零源码字符串断言（message 子串仅 Z8/S1b 用于出口归属判别，见观察 3）；成功形状经集中化 helper；失败 own 键集 `{code,message,ok,path}` 逐用例断言 |
| 独立预言机 | Yjs 原生直数（`claimedKeys`/`claimedIndexes`/`nativeMap`）、同运行公共面 `readData` oracle、字节锚常量（`factsLine`、✂ 头行）——期望与实际零同源 |
| 红绿诚实 | SA3 实现前红灯实测 38 failed/30 passed（红因统一 = 缝 2 缺口；无 where/生命周期/失败码/冻结面组预绿）；实现后 70/70 绿；F1/F2/F4 HEAD 颜色实测回填（HEAD 即绿，按预绿守卫登记，与设计 §12 预测一致） |
| 回归面 | 既有 #369/#382 家族 129 用例零改动零改红（SA3 6 文件 199 绿；SA7 独立复跑 + 探针删除后 8 files/205 复跑结果不变）；#382 条件不变式由 M1 成功分支承载继续绿 |
| 契约偏差处置 | SA3 登记 3 处 SA6 契约内部不一致（A3 total 锚 3 / A4 scalarList 非空拆分 / F1-F2-F4 HEAD 颜色）——均以 fixture 事实 + 独立预言机落地并显式登记，无断言弱化、无验收语义漂移；SA4/SA7 逐项复核成立 |
| 全仓门 | SA3 自报 + SA7 独立复跑：`pnpm typecheck` exit 0（14 工程）、`pnpm test` 400 files/4903 tests exit 0（数目对账 396+4 文件 / 4827+70+6 用例逐位一致）、形状收敛门 + 公共面守卫 46 用例绿 |

## 10. 与上游评审结论的关系

- SA2（设计 iteration 1）`approve`、SA4（实现静态）`approve`（MINOR ×3）、SA7（动态验证）`approve`、SA8 实现复查 `clear`（`requiresConflictRecheck: false`）。本审查独立复核其关键闭合项（镜像判据表、DENY 零 diff、grep 门、观察 1/3/5 收编落点）全部成立，未发现任何可致 reject 的新事实。
- SA2 非阻塞观察 1（typed-access.md L170 完备性措辞）已在实现中以从句收编（「with `where`, the one exception below: a `kept < n` window *is* the complete matched set」）——落实。
- SA2 观察 3（双合法视图值漂移暴露类）已在 Z 组头注文档化（测试文件 L717–723），无新用例、无新出口——按设计处置。

## 11. Non-blocking observations（MINOR，不阻断 approve）

1. **T4 精确序断言形态（沿 SA4 §11-1）**：`exactTasks` 用例以排序后集合等价对账，未断言键面码点序精确呈现序；序语义已由 A1/A2/K5/T12 精确承载，AC2 承重断言（kept 5 === n 5 → truncated true）保持精确。不阻断。
2. **lease 测试清理不对称（沿 SA4 §11-2）**：多数 lease 用例 release-only 未 `registry.shutdown()`——与 #369 lease 先例同款且 test scheduler + manual clock 下无真实定时器；后续测试家族可统一 `try/finally`（#382 `withLease` 形态）。不阻断。
3. **Z8/S1b message 子串断言（沿 SA4 §11-3）**：`toContain('视图不稳定')` 锚定非契约 message 字段，未来措辞改写会假红（假红优于假绿，方向安全）；出口归属的结构判别（视图③合法 ⟹ 唯一失败来源是出口②）不依赖 message。不阻断。
4. **提交主题未携 issue/ADR 引用（本审查新增）**：`feat(runtime): support filtered window reads` 未带 `(#383)`/`[ADR 0029]` 标记；仓内无书面 commit-message 规范，历史亦有无引用先例（`8a4fa40`、`docs(skill):` 系列），conventional-commit 形态本身合规。纯风格观察，不阻断。

## 12. Required revisions

无。无 BLOCKER / MAJOR finding。

## 13. 结论

最终提交在全部 SA9 标准维度——仓库 AGENTS 与模块验证门、ADR/规范一致性、模块责任归属、架构惯例与平行机制、单一事实源、生命周期对称性、文件范围（ALLOW/DENY 逐文件实测）、测试质量（先例/纪律/独立预言机/红绿诚实/全仓门）——均符合仓库工程标准；4 条 MINOR 观察不阻断。**Verdict：`approve`**。
