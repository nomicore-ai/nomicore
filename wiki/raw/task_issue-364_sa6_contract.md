# SA6 诊断与验收契约 — issue #364

**T2：readData 投影文本化原子切换——恒四键、截断事实单一载体、组合层退役（ADR 0027 决策 1/4）**

- 任务类型：**Feature**（交付形态换代 + 组合层退役；非 Bug：无语义缺陷可复现，缺口是"投影通道仍未文本化、双结果形状仍在"；含 Refactor 面：detach 深拷贝层退役、消费测试翻新）
- 诊断 HEAD：`f8a06fea4285a61bf0f48570b0269d47dfa03fb0`（短号 `f8a06fe`，分支 `mabf/issue-364`，= `origin/adr0027-projection-text` tip；T1 #363 已合入）
- 判定：**approve**（能力缺口可稳定复现、根因即"ADR 0027 决策 1/4 未实现"、契约可执行、测试入口真实；红灯签名已在 HEAD 实测）
- 交付边界：本迭代按 dispatch **不实现生产代码、不编写可执行测试**；本报告即契约本体，§12 的
  断言组与测试路径交 SA3/SA7 逐条落成测试与 fixture（落成后必须先红后绿，见 §13）。

---

## 1. Task type and inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-364.md`（Host-owned task brief） | 在场（worktree 内 untracked） | 票面 What-to-build（5 行为细节）+ AC 10 条 |
| `wiki/raw/task_issue-364_relevant_decisions.md` | **缺席**（`ls wiki/raw/*364*` 仅 brief） | 以 ADR 0027 + CONTEXT.md + 包 AGENTS 取代 |
| `wiki/raw/task_issue-364_conflict_report.md` | **缺席** | 同上 |
| `wiki/raw/task_issue-364_sa8_*.md`（SA8 产物） | **缺席** | 无设计门额外约束；本契约不代 SA8 裁决 |
| Issue #364 REST comments snapshot | **空**（dispatch 明示"none"） | 无 owner 逐字判据需转写 |
| `docs/adr/0027-readdata-projection-text.md` | 在场（HEAD 提交即设计基线） | 决策 1（恒四键）/决策 2（组装序）/决策 4（组合层）/决策 5（契约与发布）/验收缝 2/3 |
| `docs/adr/0016` / `0019` / `0024`（含 #359 amendment） | 在场 | 被修订面：交付条款、恒五键、截断清单通道；语义面（resolver/可见性/切片）为渲染器输入契约 |
| `CONTEXT.md` L38–58 | 在场（已含 ADR 0027 词汇：投影文本 / ✂ 段 / 截断省略） | 词汇基准；本票只需核对，不需重写 |
| T1 #363 产物：`packages/vfsl/src/render-projection-text.ts` + 144 测试 + `wiki/raw/task_issue-363_sa10_spec.md`（跨票台账） | 在场（HEAD 已合入） | 缝 1 冻结：渲染器两参签名、`ProjectionTruncation`、无头行（头行 = 本票组合层职责） |
| 既有 readData 消费测试/fixture（#273/#316/#333/#336/#338/#274/#359） | 在场 | 翻新对象清单与负控基线（§10/§12） |

Issue #364 与父 PR #362 的关系已核实：`git rev-parse HEAD origin/adr0027-projection-text` 同值
（`f8a06fe`），父分支只交付 ADR 0027 设计基线 + T1 渲染器；**T2 组合层零实现**
（§5 证据 E4/E5）。

## 2. Owner comment mapping

Issue comments snapshot 为空；无 owner 补充要求、无 comment ID、无 comment 内判据需要转写。
契约判据全集 = issue body 的 What-to-build 5 条 + AC 10 条 + ADR 0027 决策 1/2/4/5 + 验收缝 2/3。
逐条映射（AC → 契约组）：

| Issue AC | 契约组 | 说明 |
| --- | --- | --- |
| AC1 成功分支恒四键、truncations 不在场（负控） | CT-1 + CT-9 | 运行时 + 类型面双锚；失败分支独立键集 |
| AC2 `schema` ≡ 头行 + `renderProjectionText(resolveSchemaAtPath(...), truncations)` | CT-2 | 经 `compileSchemaEnvelope` 取 derived 作 oracle（公共 API 独立求值） |
| AC3 头行事实性（path + 预算；无预算省略） | CT-3 | 逐字节格式冻结见附录 A |
| AC4 `truncated` === 本次读发生过截断；与 ✂ 段一致 | CT-4 | 值通道口径 + ✂ 在场等价；width-only 负控（‡ 缺席） |
| AC5 `schema: null` 三情形单义；失败分支不变 | CT-5 + CT-6 | 含 lifecycle / PATH_NOT_ALLOWED / READ_OPTIONS_INVALID |
| AC6 options 闭合形状零变化回归 | CT-6 | 非法拒绝 + 合法三层透传 + canonical 等价 |
| AC7 投影 detach 深拷贝层退役 + detached 行为锚 | CT-7 | 文本形态保证隔离；克隆路径退役为结构面补充 |
| AC8 仓内全部 readData 消费测试翻新 | CT-1..CT-10 + §10 清单 | 恒五键 / JSON 投影深等 → 恒四键 / 文本 |
| AC9 作用域文档同步 + fixture 词汇重录 | CT-10 | typed-access / cordis-plugin-hosting /（fixture 作用域内）external-codegen |
| AC10 root 门禁全绿；破坏性 minor bump 归发布流程 | §13 | 本票不改版本号，diff 需无 package.json 版本改动 |

## 3. SA8 constraints

SA8 产物缺席（`ls wiki/raw/*364*` 仅 task brief）；本契约不引入 SA8 红线，只继承以下既有约束：

- **包边界**（`packages/namespace-runtime/AGENTS.md`）：读在 sequencer 外；公共 API 只暴露 detached
  投影；handle/Y.Doc/sequencer/生产工厂/seam 保持包内；`@nomicore/namespace-registry` 是 entry/lease/
  idle/production assembly 的唯一 owner。
- **包边界**（`packages/namespace-registry/AGENTS.md`）：lease 是独立 caller capability；release 幂等；
  公共 API 只经 `src/index.ts`。
- **typed Namespace 写纪律**（根 `AGENTS.md`）：本票零写路径改动；组合层**不得引入 cast** 过类型缝
  （`ReadLogicalValueTruncationEntry` ↔ `ProjectionTruncation` 结构兼容由类型系统判定，T1 §12.2 已双向锚定）。
- **ADR 0027 决策 1/2/4**：恒四键；`schema` = 投影文本 string | null；`truncations` 键删除；`truncated` 保留；
  options 闭合形状零变化；失败分支不动；单 API（不设姊妹方法/双通道）；组合层前贴头行；detach 深拷贝退役。
- **ADR 0027 决策 2（T1 冻结面）**：渲染器零选项、同步、逐字节确定、**不产出头行**；本票不得修改
  `packages/vfsl/src/render-projection-text.ts` 行为（144 条 T1 测试是冻结基线）。
- **ADR 0027 决策 5**：破坏性 minor bump 归发布流程，本票**不改版本号**；DSH 探针工具零代码改动。
- **根 `AGENTS.md` 模块指引**：改 `packages/` 前读 nearest `AGENTS.md`（已读 runtime/registry/vfsl）；
  改 `docs/` 前读 `docs/AGENTS.md`（已读：词表用 CONTEXT 权威、ADR 为历史记录、文档不得发明实现行为）。
- 本契约不新增 ADR；`CONTEXT.md` 已由 ADR 0027 提交写完（L38–58），本票只允许"零漂移核对"，
  若发现词汇漂移按 `docs/AGENTS.md` 就地修正（不在本票改语义）。

## 4. Environment and baseline

```
node v24.13.0 · pnpm 10.28.2 · vitest 3.2.7 · TypeScript 5.9.3 · tsx 4.23.12
依赖：pnpm install --offline --frozen-lockfile → 65 包全部 store 复用（0 下载），exit 0
     （仅 warning：esbuild@0.28.2 build script 被忽略——本仓测试不需其 postinstall）
```

基线（HEAD `f8a06fe`，本次实测）：

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| readData 聚焦家族（15 文件） | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <本表下清单>` | **15 files / 276 tests passed，Type Errors: no errors**（7.94s） |
| 根 typecheck | `pnpm typecheck`（14 个 tsconfig 串行） | **exit 0** |
| 根测试 | `pnpm test`（`NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`） | **381 files / 4540 tests passed，Type Errors: no errors**（588.47s） |

聚焦清单（15 文件，全部 HEAD 绿——即"旧实现旧契约自洽"基线）：
`runtime-readdata-schema-projection-red/control`、`runtime-readdata-shape-budget-red/control`、
`runtime-readdata-hostile-path-guard`、`runtime-readdata-int-range`、
`readdata-shape-assertion-consolidation-gate`、`runtime-readdata-shape-budget.test-d`、
`runtime-readdata-schema-red.test-d`、`registry-readdata-budget-passthrough.test(.test-d)`、
`registry-readdata-schema-red.test-d`、`readdata-docs-adr0016-sync-control/red`、
`render-projection-text.test`（T1 冻结基线 144 tests 绿）。

**只读基线事实**：`schema` 位当前为 JSON 四件套对象（`typeof === 'object'`），成功分支
`Object.keys === ['ok','value','schema','truncated','truncations']`；渲染器已合入但生产面
**零接线**（`grep -rn "renderProjectionText" packages/*/src | grep -v vfsl/src` → 0 命中）。

## 5. Positive reproduction（能力缺口，稳定复现）

**缺口陈述**：readData 的投影通道仍是"JSON 四件套对象 + 结构化 truncations 键"，不是 ADR 0027
决策 1/2/4 要求的"投影文本（头行 + 渲染器正文 + ✂ 段）+ 恒四键 + detach 退役"。

E1 形状探针（临时 SA6 probe，HEAD 实测，日志 `wiki/raw/task_issue-364_sa6_probe.log`）：

```bash
NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/namespace-runtime/test/zz-sa6-364-temp-probe.test.ts
# PROBE_BASELINE_KEYS=["ok","value","schema","truncated","truncations"]
# PROBE_BASELINE_SCHEMA_TYPEOF=object
# PROBE_BUDGET_KEYS=["ok","value","schema","truncated","truncations"]
# PROBE_BUDGET_TRUNCATED=true
# PROBE_BUDGET_TRUNCATIONS=[{"path":["meta"],"kind":"depth","omitted":2},{"path":["tags"],"kind":"depth","omitted":5}]
```

E2 目标契约在 HEAD 的**稳定红灯签名**（同一 probe 的 P1 用例；失败点 = 第一条目标断言，
非装置/环境/入口错误）：

```
FAIL ... > P1 target contract on HEAD (expected RED)
AssertionError: expected [ 'ok', 'schema', 'truncated', …(2) ] to strictly equal [ Array(4) ]
  [
    "ok",
    "schema",
    "truncated",
+   "truncations",
    "value",
  ]
 ❯ ...zz-sa6-364-temp-probe.test.ts:51:35
```

E3 lease 面同缺口（既有生产装配测试 `packages/namespace-registry/test/readdata-docs-adr0016-sync-control.test.ts`
L145–165 在 HEAD 通过，断言真实 Registry `lease.readData(['title'])` 恰五键 + `schema` 四键投影体 +
`truncations === []`）——即 lease 1:1 透传的形状与 runtime 同为旧形态。

E4 头行未实现：`grep -rn "# readData" packages/*/src apps/*/src domains/*/src` → **0 命中**。

E5 组合层未接线：`grep -rn "renderProjectionText" packages/*/src | grep -v vfsl/src` → **0 命中**。

E6 目标组装在 HEAD 不可达：`renderProjectionText` 是 T1 公共导出，但组合层不产出文本（E5）；
头行/✂ 语义在生产面不存在（E4）；`schema:null` + 值通道截断共存时（raw 键 + `depth:0` 实测）
只有布尔 `truncated=true` 这一个截断信号，无任何文本载体。

E7 消费面证据：仓内 `truncations` 断言分布在 runtime/registry 两个测试树（§10 清单），
`pnpm typecheck` + `vitest --typecheck` 对 `r.truncations` 的编译期锁定使"不改测试就改实现"必然红。

**缺口不是环境问题**：聚焦家族 15 文件 276 tests 全绿、根 typecheck exit 0、依赖离线装齐
（§4）——红只可能来自目标断言本身。

## 6. Negative control

负控分三层，均为**独立于目标断言**的绿断言（旧实现与目标实现下都必须绿）：

1. **值通道零变化**（doc-runtime 边界）：
   - `readLogicalValueAtPath(doc, path)` 成功分支仍恰两键 `{ok,value}`（`ReadLogicalValueResult`）；
   - 预算值读的折叠/省略语义不变（depth 折叠壳 + width 键省略；`truncated`/`truncations` 仍在
     doc-runtime 结果内，值通道载体不动）；
   - 缺席吸收纪律不变（值缺席显式 `undefined`，键恒在场）。
2. **失败分支与生命周期不变**：
   - `PATH_NOT_ALLOWED` / `RUNTIME_READ_DISABLED` / `READ_OPTIONS_INVALID` 键集与语义不变；
   - released lease → 冻结 `RELEASED_ISSUE` 短路先于一切透传；
   - `getSchema` / `getMetadata` / `getActiveSchema` 与读写能力面不受本票影响。
3. **渲染器（T1）冻结**：`packages/vfsl/test/render-projection-text.test.ts` 144 tests 全绿，
   渲染器签名/输出/✂ 文法零变化；本票只做"组合层接线"，不改渲染器。

**目标实现下的正向/负向对照**（写进新契约测试）：
- width-only 预算读：`truncated === true`、文本含 ✂ 段、**正文无 `‡`**（"width 对投影无操作"的
  可观察对偶，§9 E3 已实测）；
- 无截断读：`truncated === false`、文本无 ✂、无 `‡` 页脚；
- `schema: null`：文本不存在（`=== null`，不是空串），头行/✂ 均不可达；
- 敌意 path / 敌意 options：零 throw、零 trap 执行、收敛面不变。

## 7. Stability, scale and timing

- **无竞态/并发/网络/I/O**：渲染器是同步纯函数；组合层读在 sequencer 之外、无 await；
  稳定性判据 = **确定性**（同输入同输出逐字节相同；同 runtime 重复读、交错读稳定）。
- **规模**：主缝一致性锚矩阵建议 ≥ 9 路径 × 9 预算格（strict + raw 两夹具；本报告 §9 实测
  81 格矩阵的分类结论可直接复用），每格 O(文本规模) 纯数据；新增契约测试预期 < 2s。
- **时序**：无时钟/调度依赖；`waitForSchemaReady` 沿用既有有界 poll（5s）纪律。
- **性能承诺不在本票**：投影文本物化成本不新增基准门；唯一"零物化"回归锚（G 组
  `sentinel` non-finite 折叠读仍 ok）必须保持（§12 CT-8）。
- **全量门禁时长基线**：聚焦 7.94s；根测试见 §13（T1 报告同环境基线 593s 量级——CI 预算内）。

## 8. Root-cause chain / capability gap

| Step | Fact | Evidence | Confidence |
| --- | --- | --- | --- |
| 1 症状 | 消费方（模型上下文/DSH 探针）拿到的是 JSON 四件套 + 结构化 truncations（45.8KB vs 值 1.2KB 的编码错配） | ADR 0027 背景；issue #364 What-to-build | 高 |
| 2 直接缺口点 | runtime `readData` 成功分支组装两处恒五键（L572–578 无预算 / L600–606 预算），`schema` 位喂 `projectReadDataSchema` 的 detached 对象 | `runtime.ts` L148–172、L215–221、L552–607 源码符号 | 高（实测 E1） |
| 3 组合层同因 | `read-schema-projection.ts` 的 `detachReadSchemaProjection`/`cloneValueSchema` 对 resolver ok 产物整体深拷贝——文本形态下该层无对象可隔离 | 模块 L134–303；ADR 0027 决策 4 | 高 |
| 4 渲染器就绪但零接线 | `renderProjectionText` 已从 vfsl 公共导出（T1 冻结 144 tests），生产面 0 命中 | E5；`packages/vfsl/src/index.ts` L154 | 高（实测） |
| 5 头行无实现 | ADR 0027 规定组合层前贴头行；HEAD 生产面 `# readData` 0 命中 | E4 | 高（实测） |
| 6 最深根因 | **能力未实现**：ADR 0027 决策 1/4 已接受并在 HEAD，实现票 #364 仍 open；父分支 tip ≡ HEAD，无任何 T2 实现可复用 | `git rev-parse HEAD origin/adr0027-projection-text` 同值；E1–E5 | 高 |
| 7 放大因素 | 消费测试与文档把旧形状字面写死（恒五键/四件套/truncations），且类型面 Equal 锁使"半截双形态"编译不可行——正是 issue 要求"原子切换、不留中间态"的约束来源 | §10 清单；`runtime-readdata-shape-budget.test-d.ts` L32–39 | 高 |
| 8 未证实假设 | 头行逐字节格式（path 记法/预算段序/与正文分隔）ADR 未给全 → 本契约附录 A 冻结（§15 U1） | ADR 0027 决策 3 措辞粒度 | 已登记 |

相关性不替代因果：Step 6 的因果实验 = 只加"目标断言"即红（E2，红因可归因到多条
`truncations` 键），删掉即恢复绿；同一 HEAD、同一装置，重复运行结果一致。

## 9. Causal experiments

| # | 实验 | 控制变量 | 观察（HEAD 实测） | 结论 |
| --- | --- | --- | --- | --- |
| E1 | 形状探针（seam runtime，`readData(['meta'])` / `readData([],{depth:1})`） | 同一 HEAD、同一安装 | 恒五键；`schema` 为 object；预算读 `truncations` 2 条 | 缺口在组合层结果形状 |
| E2 | 目标断言探针（恰四键 + `'truncations' in r === false` + `typeof schema === 'string'`） | 同上 | 恰在四键断言处红（received 多 `truncations`）；后续断言未执行 | 红因 = 旧形状，可归因、可复现 |
| E3 | 81 格预算矩阵：值通道 `truncations` ↔ 投影标记数 ↔ 假想文本 ✂/‡ | strict + raw 夹具；9 路径 × 9 预算 | 全部分歧 = width-only 格：`vTrunc=true, markers=0, ✂=true, ‡=false`；**无投影标记在场而值通道不截断的格** | `truncated ⟺ ✂ 在场` 在可达矩阵成立；`‡` ≠ `truncated`（width 对投影无操作） |
| E4 | 头行符号探针 | 全 src 树 | `# readData` 0 命中 | 头行为本票新增面 |
| E5 | 渲染器接线探针 | 排除 vfsl/src | `renderProjectionText` 0 命中 | 装配序（头行→正文→✂）未实现 |
| E6 | 测试入口探针 | vitest include glob | 临时 `.test.ts` 被收集执行（`Test Files 1 failed`）；`.test-d.ts` 经 `--typecheck` 被收集（聚焦运行 4 条 `TS` 条目） | 契约测试路径将被真实 runner 发现 |
| E7 | oracle 可行性探针 | `compileSchemaEnvelope` + `resolveSchemaAtPath` + `renderProjectionText` | `resolveOk=true`，文本逐字可渲染（`[]`+depth:1 样张见附录 B）；`truncations` 原样作为渲染器第二参可用 | AC2 一致性锚不依赖任何内部 seam |
| E8 | 根门禁基线探针 | 全仓 | 聚焦 276 tests 绿；根 typecheck exit 0；根测试 381 files / 4540 tests 绿（§13） | 红不是环境/依赖问题 |

## 10. Impact surface

### 10.1 生产实现（SA3 目标面）

| 文件 | 必改点 | 契约组 |
| --- | --- | --- |
| `packages/namespace-runtime/src/runtime.ts` | 结果类型：成功成员坍缩为单一四键 `{ok,value,schema:string\|null,truncated}`（预算/legacy **成功成员同一类型**，失败面各自保留）；readData 组装序 = 头行 + `renderProjectionText(resolved, valueTruncations)`；删 `truncations` 键位；JSDoc 重录（恒四键/投影文本/头行/✂/single ok shape） | CT-1/2/3/4/7/9 |
| `packages/namespace-runtime/src/read-schema-projection.ts` | detach 深拷贝层退役（`detachReadSchemaProjection`/`cloneValueSchema*`/`cloneDocsRecord`/`cloneDiscriminator`/`cloneNumberRecord` 删除或不再走拷贝路径）；向组合层交付 resolver ok 产物（进程内直读）或直接产出文本；敌意 path → `null`、resolver 失败 → `null` 收敛不动；`InternalError` 无 catch 逃逸不动 | CT-2/5/7 |
| `packages/namespace-runtime/src/index.ts` | 公共入口 JSDoc 重录；`NamespaceRuntimeReadDataResult` / `…BudgetResult` 形状随动（名称保留、成功成员同型）；`ReadLogicalValueTruncationEntry` type-only 转出**建议退役**（原为 truncations 键而设；退役与否见 §15 U3，不影响验收断言） | CT-9 |
| `packages/namespace-registry/src/types.ts` / `lease.ts` | lease 别名跟随（Equal 锁原文保持）；`leaseReadData` 透传代码**零语义变化**；JSDoc 重录 | CT-1/9 |
| `apps/yjs-server/src/app.ts`、`packages/ws-replication/src/testing.ts` | **零改动**（只消费 `.value` / 绑定透传）；由 `pnpm typecheck` 证明不破 | 负控 |

### 10.2 测试 / fixture（SA3+SA7 翻新面）

新契约测试（必须新建；路径与断言见 §12）：

- `packages/namespace-runtime/test/runtime-readdata-projection-text-red.test.ts`（主缝红灯契约）
- `packages/namespace-runtime/test/runtime-readdata-projection-text-control.test.ts`（负控/回归锚）
- `packages/namespace-runtime/test/runtime-readdata-projection-text.test-d.ts`（类型面锚）
- `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts`（lease/装配面）
- `packages/namespace-registry/test/registry-readdata-projection-text.test-d.ts`（lease 类型面锚）

存量翻新（逐文件必改点）。全仓 readData 触及面实测：**76 个文件**（runtime 45 / registry 26 /
vfsl 3 仅注释 / ws-replication 1 / app src 1），耦合行 592 行；其中**必须改** 16 个文件
（下表），另 **3 个建议同步**（`runtime-data-interface.test-d.ts`、`registry-data-interface.test-d.ts`
补 `@ts-expect-error` 负例；`registry-phase5-bootstrap-reset-r2-internal.test.ts` L271 陈旧两键替身）；
其余经 helper 集中化随动或仅 `.ok`/`.value` 消费（编译门复核）：

| 文件 | 现状耦合 | 必改 |
| --- | --- | --- |
| `runtime/test/helpers/readdata-ok-shape.ts` | `READDATA_OK_KEYS` 五键 / `ReadDataOkShape.schema: ReadDataSchemaProjection\|null` / truncations 参数 | 四键 + `schema: string\|null` + 删 truncations 参数；反伪绿不变量（expected/actual 独立构造）保持 |
| `runtime/test/helpers/readdata-shape-assertion-scan.ts` | `SUCCESS_SHAPE_KEYS` 五键 | 四键；family A/B 判定随常量随动；样本与头注重录 |
| `runtime/test/readdata-shape-assertion-consolidation-gate.test.ts` | 五键正/负样本 | 四键正样本；五键字面量改列**负样本**（不得再视为成功形状） |
| `runtime/test/runtime-readdata-shape-budget-red.test.ts` | A/B/C/D/E/F/G/H 全组 38 处 readData | A 四键；B/C `r.truncations` 断言 → 值通道 oracle + 文本 ✂ 断言；D 标记对齐 → oracle 一致 + 文本 `‡` 在场/缺席；**E1 width 无操作** → 渲染器**正文**（不含 ✂、不含头行）逐字节相等 + ✂ 段在场 + `‡` 缺席（全文与无预算读**不等**：头行预算段 + ✂ 段两处事实差）；F/G/H 形状措辞与 `truncations` 读取改锚；F4/F5/D3/D4 的"无预算等价"→ 全文逐字节相等 |
| `runtime/test/runtime-readdata-shape-budget-control.test.ts` | 五键 + JSON 投影深等 + detach 引用互异（L162–186：`Object.isFrozen`/valueSchema 引用互异/clue mutation） | 四键 + `schema` 文本 oracle 逐字节；detach 组改文本隔离锚（string 无引用/冻结语义）；失败面（L123–142）保持 |
| `runtime/test/runtime-readdata-schema-projection-red.test.ts` | 15 条 `schema.valueSchema/aliases/docs/aliasDocs` 深等 + 引用隔离（L255–320：五层引用不共享、`Object.isFrozen`、投影 mutation 污染锚） | 全部改文本一致性锚（oracle 渲染）+ `schema:null` 三情形 + 文本隔离（G1/G2）；旧引用隔离/冻结断言整组退役；`InternalError` 逃逸锚保留（另见 `runtime-mutate-root-sequencer.test.ts` L799–810） |
| `runtime/test/runtime-readdata-schema-projection-control.test.ts` | 失败面/值语义负控（L24–80） | 基本保持；仅"成功分支形状"措辞与采样随动 |
| `runtime/test/runtime-readdata-hostile-path-guard.test.ts` | `toEqual({ok:true,value:3,schema:null})` 恰三键（L39/54/62）+ `Object.isFrozen(r.schema.valueSchema)`（L81） | 改恰四键 `{ok,value,schema:null,truncated:false}`；冻结断言退役；敌意零调用锚（L27–66）保持 |
| `runtime/test/runtime-readdata-int-range.test.ts` | 7 处 `schema.valueSchema` 深等（L139–224）+ 投影隔离组（L227–253）+ `ReadDataOkShape`（L34/90） | 改文本 oracle（`Int<1, 100>` / `Range<0.5, 1.5>` / 裸 `Int` / Record / union 等文法断言经渲染器）；隔离组改文本锚 |
| `runtime/test/runtime-readdata-shape-budget.test-d.ts` | `keyof LegacyOk/BudgetOk` 五键 Equal + `LegacyOk['truncations']` + `schema` 双投影类型 | 四键 Equal + `truncated: boolean` + `schema: string\|null` + **零泄漏负例**（`truncations` / `ReadDataSchemaProjection` 不得再出现在成功成员） |
| `runtime/test/runtime-readdata-schema-red.test-d.ts` | `HasSchemaOnOk` 锚 `ReadDataSchemaProjection\|null` | 改锚 `string\|null` + 四键；doc-runtime 保持性守卫不动 |
| `runtime/test/runtime-data-interface.test-d.ts` | `NamespaceRuntimeReadDataResult` 赋值样例 | 保持可赋值；补 `@ts-expect-error`（`r.truncations` / `r.schema.valueSchema`） |
| `registry/test/registry-readdata-budget-passthrough.test(.test-d).ts` | 五键 Equal + `viaLease.truncations.length > 0`（L219）+ `schema` 双投影类型（L44–45） | 四键 Equal + 文本 oracle + 透传引用锚（raw options 同一引用 L145–168）保持；`truncations` 断言 → 文本 ✂；released 恰三键锚（L189–200）与生产装配等价锚（L203–221）保持 |
| `registry/test/registry-readdata-schema-red.test-d.ts` | lease 别名 `schema: ReadDataSchemaProjection\|null`（L24–33） | 改 `string\|null` + 四键；别名组合锁保持 |
| `registry/test/registry-data-interface.test-d.ts` | `NamespaceLeaseReadDataResult` 赋值样例（L20） | 保持可赋值 + 四键探针 |
| `registry/test/registry-idle.test.ts` / `registry-open.test.ts` / `registry-create.test.ts` / `registry-sa7-*.test.ts` / `registry-shutdown.test.ts` | 经 `readDataOk`/`expectReadDataOk` 替身与断言（idle 11 处 / open 4 处 / rev1 4 处 / create 3 处 / hostile 2 处 / concurrency·shutdown 各 1 处生产者） | 随 helper 四键化随动（helper 签名 `readDataOk(value, schema)` / `expectReadDataOk({value,schema})` 保持，调用点零改或小改）；`registry-open` L959 失败分支 `toEqual` 与 L1002–1006 released `toEqual` 不变 |
| `registry/test/registry-phase5-bootstrap-reset-r2-internal.test.ts` | L271 陈旧两键替身 `readData: () => ({ok:true,value:1})`（类型面 `unknown`/`any`，编译器不拦） | 建议同步（非门项）为四键 shape——消灭仓内最后一处两键伪形；扫描/编译门都抓不到它，只能靠清单 |
| `registry/test/readdata-docs-adr0016-contract-fixture.ts` | 四件套/五键词汇匹配器（`hasFourKeyParagraph`/`hasKeyConventionParagraph`/`staleAnnotationViolations` 的 truncations 词锚） | 词汇重录：投影文本/恒四键/✂/头行/truncated 机器信号；旧词汇扫描门（恒五键/truncations/四件套交付） |
| `registry/test/readdata-docs-adr0016-sync-control.test.ts` | 行为锚五键 + 匹配器正负样本 | 行为锚四键 + 文本；匹配器正负样本按新词汇双向重录 |
| `registry/test/readdata-docs-adr0016-sync-red.test.ts` | R3/R4 四件套交付要求 | 改 R3' 投影文本具名 / R4' ✂ 段与头行；R1/R2/R5/R6/R7 重录 ADR 0027 词汇 |

### 10.3 文档（CT-10）

- `.agents/skills/nomicore/typed-access.md`：L43、L110、L126、L130–132 五键/truncations/JSON 投影
  词汇 → 投影文本词汇（恒四键、`schema` 为 string|null、✂ 段为截断事实唯一载体、`truncated` 机器信号）；
  **预算纪律三句（L126/L130/L132 静态完整性/可选访问/非写前快照）必须原文保留**（既有负控锚）。
- `docs/integration/cordis-plugin-hosting.md`：L340–352 readData 示例注释（恒五键 + `truncations` 条目）
  → 恒四键 + 投影文本样张（头行/正文/✂）；跨 realm 陷阱节（L379–386）语义不变。
- `docs/integration/external-project-vfsl-codegen.md`：L288 "恒五键/truncated+truncations" → 恒四键 + 文本；
  适配器示例（只收窄 `.value`）零代码变化。
- `CONTEXT.md`：**只读核对**（ADR 0027 已写完词汇）；若发现漂移按 docs/AGENTS 修正。

### 10.4 明确不触碰（红线）

- `packages/vfsl/src/**`（渲染器冻结；T1 `render-projection-text*.test.ts` 零改动）；
- `packages/vfsl/test/resolve-schema-at-path*.test.ts`（resolver 自己的 JSON 四件套输出仍是
  渲染器输入契约，ADR 0027 决策 2——零改动）；
- `packages/doc-runtime/**`（值通道 + `ReadLogicalValueTruncationEntry` 形状冻结；
  `doc-runtime/test` 零 readData 引用）；
- `docs/adr/**`（0016/0024/0008/0019 已有修订指针；0027 为权威，不改写历史 ADR 正文）；
- `CONTEXT.md` 语义（只核对）；
- 版本号/发布链（`package.json` version、lockfile 版本、publish 脚本）——发布归发布流程；
- 根 `vitest.config.ts` / `tsconfig*.json`（入口不变）；
- readData 的写路径、replication、diagnostic（零关系）；
- ws-replication / apps/yjs-server 仅 `.ok`/`.value` 消费（零改动，由根 typecheck + 全量测试证明）。

## 11. Ruled-out hypotheses（排除项）

| 假设 | 排除证据 |
| --- | --- |
| 渲染器缺失/不完整（缺口在 vfsl） | T1 已合入：`renderProjectionText` 公共导出 + 144 tests 绿；本票缺口是组合层零接线（E5） |
| 红是依赖/环境问题 | 离线安装 exit 0；聚焦 276 tests 绿；根 typecheck exit 0（E8） |
| 只需改测试、行为已达标 | HEAD 实测恒五键 + object schema（E1/E2）——行为面确实未切换 |
| "半截双形态"可行（保留 truncations 兼容期） | issue 明令原子切换；类型面 Equal 锁 + 消费测试字面断言使双形态必须同时改，无中间绿 |
| 头行可由渲染器产出 | T1 契约明文"不产出头行（组合层职责）"+ G1.3 反断言（`# readData [` 0 命中）；本票必须在组合层前贴 |
| width-only 预算读文本应与无预算读**全文**逐字节相等（原 ADR 0024 E1 断言直译） | 头行事实性条款要求预算段在场 → 全文必然不等；相等性收窄为"渲染器正文逐字节相等"（§12 CT-4 负控） |
| 投影标记（‡）在场等价于 `truncated` | 81 格矩阵：width-only 格 `truncated=true` 且 `‡` 缺席（E3）——二者非等价 |
| 组合层可保留深拷贝（文本也克隆） | 文本是原始值，克隆无对象可操作；ADR 0027 决策 4 明令退役；行为锚改为"文本与活 schema 零交叉污染"（CT-7） |
| 需要改 ADR/CONTEXT | ADR 0027 已接受并写完词汇；本票是执行票 |
| 破坏性 minor bump 需在本票改版本号 | issue AC10 明示"归发布流程，不在本票改版本号" |

## 12. Acceptance contract and test paths

> 断言纪律（沿用 #273/#336 契约）：只观察公共接缝运行时输出；oracle 只用公共 API 独立求值
> （`compileSchemaEnvelope` → `resolveSchemaAtPath` → `renderProjectionText`；值通道直调
> `readLogicalValueAtPath`）；不 skip/only/todo/env override/fallback；不吞错；不做源码字符串断言
> 代替行为验证；装置前提失败 fail loud。

### 12.0 公共 oracle recipe（所有断言组共用）

```ts
// 装置（seam fixture）：handle 持有 SCHEMA 信封 + ROOT；runtime 经 createNamespaceRuntimeWithSeam
// 编译同一信封（确定性 → derived 同构）；测试另持 doc 以便值通道直调。
const compiled = compileSchemaEnvelope(ENV);               // public API，Σ derived 作 oracle
const resolved = resolveSchemaAtPath(compiled.derived, path, options); // 无预算省略第三参
const valueOracle = options === undefined
  ? readLogicalValueAtPath(doc, path)                       // { ok:true, value }（无 truncated）
  : readLogicalValueAtPath(doc, path, options);             // { ok:true, value, truncated, truncations }
const body = renderProjectionText(resolved, options === undefined ? undefined : valueOracle.truncations);
const expected = headLine(path, effectiveOptions(options)) + '\n\n' + body; // 格式冻结：附录 A
```

### CT-1 恒四键 / truncations 退役（AC1）

测试：`runtime-readdata-projection-text-red.test.ts`（A 组）+ `registry-readdata-projection-text-red.test.ts`（A' 组）+ `*.test-d.ts`（见 CT-9）。

| # | 断言 | 观测面 | 负控 |
| --- | --- | --- | --- |
| A1 | 无预算成功读：`Object.keys(r).sort()` 严格等于 `['ok','schema','truncated','value']`；`Reflect.ownKeys(r)` 无 symbol；`'truncations' in r === false`；`JSON.stringify(r)` 不含 `"truncations"` | 运行时 | 旧实现该断言红（E2） |
| A2 | 预算成功读（多组合法 options，含触发/不触发截断）：同 A1 键集 | 运行时 | 同上 |
| A3 | `ok === true`；`value` 键恒在场（缺席为显式 `undefined`）；`truncated` 恒为 boolean | 运行时 | 删任一键 → 键集断言红 |
| A4 | 失败分支键集严格等于 `{ok,code,path,message}`（PATH_NOT_ALLOWED / READ_OPTIONS_INVALID / RUNTIME_READ_DISABLED；message 可选成员按 doc-runtime 原样）；**不含** schema/truncated/truncations | 运行时 | 失败分支塞任一成功键 → 红 |
| A5 | released lease：`lease.readData(path)` 等于冻结 `RELEASED_ISSUE`（短circuit 先于一切透传，键集不变） | 运行时 | 透传被短路破坏 → 红 |
| A6 | `lease.readData(path[, options])` 与同参 `runtime.readData` **键集与值逐字段相等**（含 string 逐字节） | 运行时 | 别名漂移 → 红 |

### CT-2 一致性锚：`schema` ≡ 头行 + 渲染器正文（AC2）

测试：主缝红灯文件（B 组）+ control 文件（B' 组）。矩阵：≥ 9 路径 × ≥ 9 预算（沿用
`runtime-readdata-shape-budget-fixture.ts` strict/raw 两夹具），对**schema 非 null 的每一格**：

| # | 断言 | 观测面 |
| --- | --- | --- |
| B1 | `r.schema === headLine(path, effectiveOptions) + '\n\n' + renderProjectionText(resolveSchemaAtPath(compileSchemaEnvelope(env).derived, path, options), valueOracle.truncations)` —— **逐字节**（`===`，不得用 deep-equal 对象断言替代） | 运行时 vs 公共 oracle |
| B2 | 无预算格：`renderProjectionText(resolved)` 第二参缺席/`undefined`/`[]` 三态逐字节同（T1 已锚，组合层继承） | 运行时 |
| B3 | `resolved.ok === false`（路径偏离）⇔ `r.schema === null`（严格 null）；不得出现"文本非空但投影失败"或"null 却在文本里补头行" | 运行时 |
| B4 | 每次读重新求值：连续两次同参读逐字节相等；`runtime.replaceSchema(newEnv)` 后同路径读的文本反映**新** derived（无缓存/无陈旧文本） | 运行时 |
| B5 | 一致性锚的 oracle 独立性：期望串由**独立编译**的 derived 渲染，且测试不得从 `r.schema` 反推期望（反伪绿：expected 与 actual 两条独立构造路径） | 测试结构不变量 |

### CT-3 头行事实性（AC3）

测试：主缝红灯文件（C 组）。格式冻结见附录 A（本契约 SA6 钉死；ADR 0027 未逐字给全，见 §15 U1）。

| # | 断言 | 观测面 |
| --- | --- | --- |
| C1 | 空路径无预算：文本以 `# readData []\n\n` 开头 | 运行时 |
| C2 | 多段路径（含数字段）：`readData(['meta','content'])` 头行含 `meta.content`；`readData(['tags',1])` 含 `tags.1` | 运行时 |
| C3 | 头行反映**实参 path**而非解析路径/别名名：`['meta']` → `meta`（不是 `Meta`）；resolver 命中 ref/别名时同样如实 | 运行时 |
| C4 | 预算段：`{depth:1}` → `# readData [] {depth:1}`；`{maxChildrenPerNode:3}` → `{maxChildrenPerNode:3}`；两者 → `{depth:1,maxChildrenPerNode:3}`（键序 depth → maxChildrenPerNode，逗号无空格） | 运行时 |
| C5 | 无预算省略预算段：无 options / `{}` / `{depth: undefined}` / 非 enumerable depth / 继承键污染 → 头行**无** `{…}` 且全文与无 options 读逐字节相等 | 运行时 |
| C6 | 行注入防御：path 段含 `\n`/`\r\n` → 头行内折叠为空格（与 ✂ 段 path 记法同规则），文本行数不因敌意段增加 | 运行时 |
| C7 | `schema === null` 时无头行（`# readData` 不可达；schema 严格 null） | 运行时 |

### CT-4 截断事实一致性（AC4）

测试：主缝红灯文件（D 组）+ control（D' 组）。

| # | 断言 | 观测面 | 负控 |
| --- | --- | --- | --- |
| D1 | `r.truncated === valueOracle.truncated`（预算）；无预算 `truncated === false` | 运行时 | 固定 false/true → 红 |
| D2 | `schema !== null` 时：`r.truncated === r.schema.includes('✂ 截断事实：')`；`schema === null` 时无文本可比，D1 独占 | 运行时 | 段在场而不置位（或反之）→ 红 |
| D3 | 触发 depth 截断（如 `[]`+`depth:1`）：`truncated=true`、✂ 段在场、正文含 `‡`（标记位）且页脚在场 | 运行时 | 抹掉 ✂ → 红 |
| D4 | **width-only** 截断（如 `['tags']`+`{maxChildrenPerNode:3}`）：`truncated=true`、✂ 段在场、正文**无 `‡`**（width 对投影无操作的可观察对偶） | 运行时 | 在正文补 `‡` → 红 |
| D5 | 无截断（充足 depth / 标量路径 / 无预算）：`truncated=false`、文本无 ✂、无 `‡` | 运行时 | 空清单也渲染 ✂ → 红 |
| D6 | `schema:null` × 预算截断（raw 键 + `depth:0`）：`schema === null` 且 `truncated === true`（ADR 0027 已知限制 2 的诚实形态） | 运行时 | 把 truncated 也抹成 false / 塞空串 → 红 |
| D7 | 值通道折叠/省略语义零变化：depth 折叠空壳 + 条目、width 键省略、`omitted` 语义（直接子项数）、零物化哨兵（non-finite 折叠读 ok）——沿用既有 B/C/G 组断言，只把 `truncations` 读取面换成值通道 oracle | 运行时 | 值通道被顺手改动 → 红 |

### CT-5 `schema: null` 单义与失败/生命周期不变量（AC5）

测试：主缝红灯文件（E 组）+ control（E' 组）。

| # | 断言 | 观测面 |
| --- | --- | --- |
| E1 | 三情形——① 无 active schema（preparing / unavailable / fatal）；② 路径偏离 schema（raw 键）；③ 敌意 path（重定义 `Symbol.iterator` / Proxy 数组）——`r.schema === null`（严格 null，**非空串**）；`ok === true`；value 照常；无外抛 | 运行时 |
| E2 | 敌意 path 的敌意函数/trap **零调用**（调用计数器），`schema === null` 收敛不变 | 运行时 |
| E3 | lifecycle：`closing`/`closed` → `RUNTIME_READ_DISABLED` 恰四键，先于一切 options 读取与 doc 触碰；released lease → released issue 短路 | 运行时 |
| E4 | 定序：非法 path + 非法 options → `PATH_NOT_ALLOWED`；closing/closed + 非法 options → `RUNTIME_READ_DISABLED` | 运行时 |
| E5 | 可信域 `InternalError` 逃逸通道保持唯一：注入畸形 derived（compile seam）→ readData **throw**（构造名 `InternalError`），不得被渲染器/组合层 catch 成 `schema:null` 或吞掉（`runtime-mutate-root-sequencer.test.ts` L799–810 断言面延续） | 运行时 |
| E6 | 敌意输入零 throw：敌意 path/options/P0 未就绪/持久化降级/fatal 下 readData 均不抛、成功面照常（读保留） | 运行时 |

### CT-6 options 闭合形状零变化（AC6）

测试：主缝红灯文件（F 组，沿用现有 F 矩阵与 F-x 敌意构造器）+ registry 透传测试。

| # | 断言 | 观测面 |
| --- | --- | --- |
| F1 | 非法 options 矩阵（未知键/负数/非整数/NaN/±Infinity/非对象/数组/类实例/自定义原型/accessor/width 未知键）→ `READ_OPTIONS_INVALID`，恰 `{ok,code,path,message}`，path 新鲜回显，message 非空，**绝不** `schema:null` 静默 | 运行时 |
| F2 | 差分矩阵：runtime 接受集/拒绝码 ≡ `readLogicalValueAtPath` 权威（零泄漏单源）；F-x1..F-x6（非 enumerable / 继承污染 / descriptor-get 分叉 / 抛错 get trap / 状态化 / 交替 descriptor）语义与 trap 计数不变 | 运行时 |
| F3 | canonical 等价：`{}`、`{depth: undefined}`、非 enumerable depth、继承键污染 → 与无 options 读**全文逐字节相等**（含头行无预算段） | 运行时 |
| F4 | lease 三层透传：active 期 raw options **同一引用**抵达 runtime（零复制/零校验/零触达）；released 短路先于一切透传；真实生产装配（Registry create）lease 结果与 runtime 直调逐字段相等 | 运行时 |

### CT-7 detach 深拷贝层退役与文本隔离（AC7）

测试：主缝红灯文件（G 组）；结构面补充在 `*.test-d.ts` 与 SA4 审查证据。

| # | 断言 | 观测面 |
| --- | --- | --- |
| G1 | `typeof r.schema === 'string'`（非 null 时）；结果对象图内无投影对象（`JSON.stringify(r)` 不出现 `"valueSchema"` 键） | 运行时 |
| G2 | 文本与 runtime 活 schema 零交叉污染：同参连续/交错读逐字节相等；调用方改写 `r.value`（深对象）后重读文本不变；`replaceSchema` 后文本随新 derived 变化（无陈旧缓存） | 运行时 |
| G3 | 旧 detach 断言（`Object.isFrozen` / 引用互异 / marker clue 引用不同）**不得**以文本语义原样保留（它们对 string 无意义）；替换为 G1/G2 + B1 的一致性锚（expected 由独立编译的 derived 渲染 → 证明运行时不共享其活对象） | 测试结构 |
| G4 | 结构面补充（非替代行为锚）：`projectReadDataSchema` 返回类型为 `string \| null`（内部类型级锚）；`read-schema-projection.ts` 中投影克隆符号（`detachReadSchemaProjection` / `cloneValueSchema` 家族）不再存在——由 SA4 的 AST/符号审查证据记录 | 内部 seam |

### CT-8 类型面（AC1/AC2/AC7 编译期锁）

> **"结果类型坍缩为单一四键形"的契约解释**（ADR 0027 决策 4 / issue What-to-build）：
> 成功成员坍缩为**同一个四键类型**（原 `ReadDataSchemaProjection | null` 与
> `BudgetedReadDataSchemaProjection | null` 两支消失）；两个结果**联合名**
> （`NamespaceRuntimeReadDataResult` / `NamespaceRuntimeReadDataBudgetResult`，及 lease 对偶）
> 与双重载签名保留——因为失败面结构不同（`READ_OPTIONS_INVALID` 对 legacy 重载结构不可达，
> I5 零泄漏锁要求）。若实现把两联合合并为单一联合，则 legacy 面将结构上可达
> `READ_OPTIONS_INVALID`，违反 ADR 0024 决策 6「零泄漏」与 issue AC6「失败码不动」——
> 该解释仅接受成功成员的同型坍缩。H4 的别名组合锁按此解释保持。

测试：`runtime-readdata-projection-text.test-d.ts` + `registry-readdata-projection-text.test-d.ts`（并同步翻新既有
`runtime-readdata-shape-budget.test-d.ts`、`runtime-readdata-schema-red.test-d.ts`、
`registry-readdata-budget-passthrough.test-d.ts`、`registry-readdata-schema-red.test-d.ts`）。

| # | 断言 |
| --- | --- |
| H1 | `Equal<keyof Extract<NamespaceRuntimeReadDataResult,{ok:true}>, 'ok'\|'value'\|'schema'\|'truncated'>`；预算联合成功成员同型（**单一四键形**） |
| H2 | `Equal<Ok['schema'], string \| null>`（精确可空，无 undefined 第三态）；`Equal<Ok['truncated'], boolean>` |
| H3 | `Extract<NamespaceRuntimeReadDataResult, { truncations: unknown }> === never`；`Extract<…BudgetResult…>` 同；`@ts-expect-error`：`r.truncations` 与 `r.schema.valueSchema` 编译失败 |
| H4 | lease 别名组合锁保持：`NamespaceLeaseReadDataBudgetResult = NamespaceRuntimeReadDataBudgetResult \| NamespaceLeaseReleasedIssue`；重载序 legacy 最后；`READ_OPTIONS_INVALID` 零泄漏（只属预算联合）；release issue 形状不变 |
| H5 | doc-runtime 保持性守卫不动：`ReadLogicalValueResult` ok 仍恰 `{ok,value}`、`ReadLogicalValueTruncationEntry` 形状不变（值通道冻结） |
| H6 | 渲染器入参结构兼容零 cast：`readonly ReadLogicalValueTruncationEntry[]` 可赋值给 `renderProjectionText` 第二参（T1 已双向锚定，组合层不得引入 `as`） |

### CT-9 仓内消费面翻新门（AC8）

| # | 断言 | 观测面 |
| --- | --- | --- |
| I1 | **编译门**：翻新后 `pnpm typecheck` + `vitest --typecheck` 全绿——任何遗留 `r.truncations` / `schema.valueSchema` / 五键 Equal 锁都会编译红 | 全仓 |
| I2 | **形状断言收敛门**：`readdata-shape-assertion-consolidation-gate.test.ts` 四键化后 family A/B 归零；扫描器 `SUCCESS_SHAPE_KEYS` 四键化 + family B 元数判定 L192 随动；五键字面量样本必须命中（正样本），四键字面量与集中化构造不得命中（负样本）；family A 检测器（`ok:true && hasSchema`）对四键字面量天然继续命中 | AST 扫描门 |
| I3 | **零遗留旧词汇**：runtime/registry 测试树中不存在"成功分支恰五键/truncations 键"的行为断言（扫描器 + 编译门双保险）；`readData` 仅作 setup 的文件保持绿。**清单补充**：`registry-phase5-bootstrap-reset-r2-internal.test.ts` L271 的陈旧两键替身（类型面 `unknown`/`any`，扫描器与编译门都抓不到）建议人工同步——否则仓内仍留一处两键伪形（非门项） | 全仓 |
| I4 | 失败分支字面断言（如 `registry-open.test.ts` L959 `toEqual({ok:false,code:'PATH_NOT_ALLOWED',path:['nope']})`、L1002–1006 released 恰三键、`registry-readdata-budget-passthrough.test.ts` L189–200 released 短路恰三键）保持不变 | 既有测试 |
| I5 | 失败面无新键的类型锁保持：`runtime-readdata-shape-budget.test-d.ts` L58–63 与 `registry-readdata-budget-passthrough.test-d.ts` L61–66（失败成员不含 truncated/schema/truncations）继续绿 | 类型面 |

### CT-10 文档负控与词汇重录（AC9）

| # | 断言 | 观测面 |
| --- | --- | --- |
| J1 | `.agents/skills/nomicore/typed-access.md`：说明恒四键、`schema` 为投影文本（头行/正文/✂）、`truncated` 机器信号、"null 不是读的失败"、消费方式；**预算纪律三句原文保留**；权威源挂接 **ADR 0027（交付形态）+ ADR 0016/0024（语义/预算）**——R1 的 `adr0016Refs` 门必须放宽为"0027 在场且 0016/0024 语义引用在场"，否则新文档切换词汇即假红 | 文档匹配器 |
| J2 | `docs/integration/cordis-plugin-hosting.md`：readData 示例注记四键 + 文本（无 `truncations`）；跨 realm 陷阱节保留 | 文档匹配器 |
| J3 | `docs/integration/external-project-vfsl-codegen.md`：L288 旧五键陈述改为四键 + 文本 | 文档匹配器 |
| J4 | 作用域文档**旧词汇清退**：`恒五键` / `truncations`（readData 交付语境）/ `{ ok: true, value, schema, truncated, truncations }` / `valueSchema`+`aliasDocs` 作为交付体的陈述 → 扫描归零 | 负控扫描 |
| J5 | 作用域文档**新词汇在场**：`投影文本`/`projection text`、`恒四键`、`✂` 段、`truncated` 布尔机器信号、ADR-0027 引用 | 正样本匹配器 |
| J6 | 匹配器敏感性自控：新词汇正样本命中、旧词汇负样本命中（双向），防关键词空转伪绿；`readDataOptionUsages`（schema opt-in 负控）与 `hasBudgetDisciplineParagraph` 保持。**`staleAnnotationViolations` 必须双向修复**：现谓词（要求 schema+truncated+truncations 全在场）对新四键注记**假红**、对旧五键注记**假绿**；新谓词 = 要求 `ok/value/schema/truncated`，把 `truncations` 在场视为陈旧；`hasFourKeyParagraph`（valueSchema+aliasDocs）与 `hasKeyConventionParagraph`（aliasDocs+键规约）为旧词汇专用，必须重录为投影文本/✂ 词汇，否则 R3/R4 在文档切换后假红 | 自控样本 |
| J7 | `CONTEXT.md` 零漂移核对：投影文本/✂ 段/截断省略词条与实现一致（只读检查，不要求改动）。**ADR 历史文本保持**：`readdata-docs-adr0016-sync-control.test.ts` L294–313 对 `docs/adr/0016`（含 `schema: ReadDataSchemaProjection \| null`）与 `docs/adr/0024`（含 `truncated: boolean; truncations: TruncationsEntry[]`）的权威源健全性门**保持在场且绿**——ADR 是历史记录，修订指针由 ADR 0027 承担（docs/AGENTS）；不得为过门而改写 ADR 正文（watch 项） | 文档读取 |

### 12.11 突变敏感性要求（反伪绿，实施期必做）

实现完成后必须执行以下突变（临时改实现→跑契约→还原），证明断言对目标行为敏感（记录在
SA7 报告）：

| 突变 | 必须击穿 |
| --- | --- |
| M1 恢复 `truncations` 键（或保留五键成功形） | CT-1 A1/A2、CT-8 H1/H3 |
| M2 `schema` 返回 JSON 投影对象而非 string | CT-1 A1（键集不变但类型红）、CT-2 B1、CT-7 G1 |
| M3 去掉 `truncated` 键 | CT-1 A1/A3 |
| M4 组合层不贴头行 | CT-2 B1、CT-3 C1–C5 |
| M5 截断非空但不渲染 ✂（或空清单也渲染 ✂） | CT-4 D2/D3/D5 |
| M6 头行打印解析路径/别名名而非实参 path | CT-3 C3 |
| M7 删除敌意 path 的 null 收敛（或让陷阱执行） | CT-5 E1/E2 |
| M8 detach 层保留并在文本外额外返回对象 | CT-7 G1 |

## 13. Red/green or baseline evidence

**当前 HEAD（诊断基线，全部本次实测；原始日志 `wiki/raw/task_issue-364_sa6_baseline.log`）**

| 证据 | 命令 | 结果 |
| --- | --- | --- |
| 聚焦家族绿基线 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run <§4 15 文件>` | 15 files / 276 tests passed，no type errors（4.44s；首轮 7.94s） |
| 根 typecheck 绿基线 | `pnpm typecheck` | exit 0 |
| 根测试绿基线 | `pnpm test` | **381 files / 4540 tests passed，Type Errors: no errors**，exit 0（588.47s） |
| 目标契约红基线 | 临时 probe P1（恰四键 + `'truncations' in r` + `typeof schema === 'string'`） | 红于第一条断言，received 多 `truncations`（§5 E2，日志 `wiki/raw/task_issue-364_sa6_probe.log`） |
| 头行/接线缺口 | `grep -rn "# readData" packages/*/src`；`grep -rn renderProjectionText packages/*/src \| grep -v vfsl/src` | 0 / 0 |
| 81 格两通道矩阵 | 临时 probe P2（已清理） | 分歧仅 width-only：`truncated=true` / ✂ 在场 / `‡` 缺席；无"投影独截"格 |

**实施期（SA3+SA7）必须补齐的红→绿序列**：

1. 先落 **CT-1..CT-10 的可执行测试/fixture**（含新红文件），在未改生产代码的 HEAD 上运行
   `npx vitest run <新契约文件> --typecheck` → **必须红**，且红点 = 四键/字符串/头行/✂ 断言
   （失败消息可归因），不得红在装置/入口/oracle 前置；记录完整输出。
2. 再改生产实现（§10.1）→ 新契约测试转绿、CT-9 编译门绿、CT-10 文档门绿。
3. 最后跑 `pnpm typecheck` + `pnpm test`（root，`--typecheck`）全绿；执行 §12.11 突变并还原；
   `git diff --stat` 核对无 §10.4 红线文件改动、无版本号改动。

## 14. Runner trigger evidence

- `vitest.config.ts`：`test.include = ['packages/*/test/**/*.test.ts','domains/*/test/**/*.test.ts','apps/*/test/**/*.test.ts']`
  → §12 新 `*.test.ts` 自动发现；`test.typecheck.include = ['packages/*/test/**/*.test-d.ts', …]`、
  `tsconfig: './tsconfig.typecheck.json'` → 新 `*.test-d.ts` 进 `pnpm test --typecheck`。
- 包级 `tsc`：`packages/namespace-runtime/tsconfig.json` 与 `packages/namespace-registry/tsconfig.json`
  均 `include` `src/**/*.ts` + `test/**/*.ts` → 新测试/fixture 也进 `pnpm typecheck`。
- **实测触发**（E6）：临时 `packages/namespace-runtime/test/zz-sa6-364-temp-probe.test.ts` 被
  `vitest run <path>` 收集并执行（`Test Files 1 failed (1)`，失败即 P1 契约断言）；聚焦运行的
  4 条 `TS` 条目证明 `.test-d.ts` 经 `--typecheck` 被收集。
- 契约测试命名沿用既有 `*-red` / `*-control` / `*.test-d.ts` 惯例；根 `pnpm test` 使用
  `NODE_OPTIONS=--conditions=nomicore-source`（源码条件导出）——新文件无需任何 runner 配置改动。

## 15. Unknowns and blockers

| # | 未决/风险 | 影响 | 处置 |
| --- | --- | --- | --- |
| U1 | **头行逐字节格式 ADR 未给全**：path 记法（点分 vs JSON）、数字段、行注入折叠、预算段键序、与正文的分隔（空行） | CT-2/CT-3 的 oracle 期望串依赖它；不同选择 = 不同契约 | 本契约附录 A **SA6 冻结**（依据：ADR 0027 决策 3 `# readData [<path>] {depth:N}` 原文 + 渲染器段落"恰 1 空行"惯例 + ✂ 段 path 记法一致）。设计若偏离必须先显式修订本契约，再落测试 |
| U2 | `truncated` 是否取"值通道 ∨ 投影标记"的 OR 语义 | 可达矩阵（81 格）内两种实现不可区分（无"投影独截"格）；极端自造 derived 可能出现 | 契约钉死 `truncated === valueOracle.truncated`（无预算 false）+ `⟺ ✂ 在场`；若设计演示出可达的"投影独截"格，则按 issue AC4 改为 OR 并同步修订 CT-4 |
| U3 | `ReadLogicalValueTruncationEntry` 是否继续从 `@nomicore/namespace-runtime` 公共面转出（原为 truncations 键而设） | 类型导出面破坏性决策；不影响行为断言 | SA6 建议**退役**（死词汇）；若保留，须在 JSDoc 说明其为值通道/doc-runtime 事实而非 readData 交付键。两种选择都不改变 CT-1..CT-10 |
| U4 | `schema:null` × 预算截断的键级消歧失去 ✂（ADR 0027 已知限制 2） | 消费方只能看 `truncated` 布尔 | 契约以 CT-4 D6 锚定诚实形态；文档同步须如实陈述（不得谎称可消歧） |
| U5 | 头行 path 段含 `.`/空白等歧义字符的呈现（点分记法不可逆解析） | 头行是"事实锚/人读"，不是可解析结构 | 附录 A 明确其为呈现形态（不承诺 round-trip）；程序化结构需求走 resolver 直达 |
| U6 | 全量根测试时长（本环境实测 588.47s / 381 files / 4540 tests，见 §4/§13） | CI 预算 | 无阻塞；沿用 `maxWorkers: 1` 基线 |
| U7 | 版本号 bump / release 链 | 破坏性 minor | 明确**不在本票**（AC10）；diff 核对无版本改动 |

无阻断性 blocker：环境齐备、缺口可复现、oracle 可达、测试入口真实。

## 16. Temporary diagnostics cleanup

- 临时诊断件：`packages/namespace-runtime/test/zz-sa6-364-temp-probe.test.ts`（P0 基线形状、P1 目标
  契约红灯、P2 81 格两通道矩阵、P3 null/失败面）——**已删除**：
  `rm packages/namespace-runtime/test/zz-sa6-364-temp-probe.test.ts`；复核
  `ls packages/namespace-runtime/test | grep zz-sa6-364` → 0 命中。
- 临时件证据留存：`wiki/raw/task_issue-364_sa6_probe.log`（探针 stdout + 红灯签名原文）；
  基线门禁日志 `wiki/raw/task_issue-364_sa6_baseline.log`（聚焦家族 / 根 typecheck / 根测试记录）。
- 无生产代码改动、无测试改动：`git status --porcelain` 仅 `?? wiki/raw/task_issue-364.md`（Host brief）
  与 `?? wiki/raw/task_issue-364_sa6_probe.log`、`?? wiki/raw/task_issue-364_sa6_baseline.log`、
  `?? wiki/raw/task_issue-364_sa6_contract.md`（本报告）。
- 依赖安装产物：`node_modules/`（离线 store 复用）为 gitignored 工作区物；无服务/nohup/PID 文件残留
  （未启动任何服务）。

---

## 附录 A：投影文本组装格式（SA6 冻结，供 CT-2/CT-3 期望串使用）

```
schema（非 null） = headLine(path, effectiveOptions) + "\n\n" + renderProjectionText(resolved, valueTruncations)
                   // renderProjectionText 输出以恰一个 "\n" 结尾；正文与 ✂ 段均在其中

headLine(path, effectiveOptions) =
    "# readData [" + pathText + "]" + budgetSuffix

pathText = path.length === 0 ? "[]" : path.map(foldSegment).join(".")
foldSegment(seg) = String(seg).replace(/\r\n|\n|\r/g, " ").trim()   // 行注入防御；与 ✂ 段 path 记法同规则

budgetSuffix =
    ""                                                     // 有效预算两键皆缺席（无 options / {} / 全 undefined / 非 own-enumerable / 继承键）
  | " {depth:" + String(depth) + "}"                       // 仅 depth
  | " {maxChildrenPerNode:" + String(k) + "}"              // 仅 maxChildrenPerNode
  | " {depth:" + String(depth) + ",maxChildrenPerNode:" + String(k) + "}"   // 两者（键序固定）

effectiveOptions = 组合层 canonical 净化后的有效预算（present-undefined 剥离、-0 归一、仅 own-enumerable）
schema === null   → 无 headLine、无正文、无 ✂；严格 null（非空串）
```

依据：ADR 0027 决策 3 头行原文 `# readData [<path>] {depth:N}`；issue AC3
"预算读印 `{depth:N[,maxChildrenPerNode:K]}`，无预算省略"；渲染器"相邻段落恰 1 空行 + 输出以恰
一个 `\n` 结尾"惯例；✂ 段 path 记法（T1 `renderTruncations`）一致。属于本契约的**规范冻结**，
设计偏离需先修订本契约（§15 U1）。

## 附录 B：oracle 样张（HEAD 实测，`[]` + `{depth:1}`，strict fixture）

组合层目标输出（`# readData [] {depth:1}` 为待实现头行；其下为 T1 渲染器实测正文）：

```text
# readData [] {depth:1}

{
  title: string // 页面标题
  count: number
  meta: Meta‡ // 元数据
  tags: [...]‡ // 标签组
  nick?: string // 可选昵称
}

‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。

✂ 截断事实：
- meta · depth · 省略 2 项
- tags · depth · 省略 5 项

```

值通道 oracle（同一装置）：`truncated=true`，
`truncations=[{path:['meta'],kind:'depth',omitted:2},{path:['tags'],kind:'depth',omitted:5}]`。

## 附录 C：契约组 → 测试路径索引

| 契约组 | 主文件 |
| --- | --- |
| CT-1/2/3/4/5/6/7/9 | `packages/namespace-runtime/test/runtime-readdata-projection-text-red.test.ts` |
| CT-1..CT-8 负控/回归 | `packages/namespace-runtime/test/runtime-readdata-projection-text-control.test.ts` |
| CT-8（类型面） | `packages/namespace-runtime/test/runtime-readdata-projection-text.test-d.ts`（+ 既有 4 个 `*.test-d.ts` 翻新） |
| CT-1/4/6（lease/装配） | `packages/namespace-registry/test/registry-readdata-projection-text-red.test.ts` |
| CT-8/9（lease 类型） | `packages/namespace-registry/test/registry-readdata-projection-text.test-d.ts`（+ 既有 `registry-readdata-*.test-d.ts` 翻新） |
| CT-9（收敛门） | `packages/namespace-runtime/test/readdata-shape-assertion-consolidation-gate.test.ts` + `helpers/readdata-shape-assertion-scan.ts` |
| CT-10（文档负控） | `packages/namespace-registry/test/readdata-docs-adr0016-contract-fixture.ts` + `…-sync-control.test.ts` + `…-sync-red.test.ts` |
| §12.11 突变 | SA7 报告（临时改实现→跑契约→还原，记录击穿面） |
