# SA6 诊断与验收契约 — issue #369 W2：lease 公共面 `readArray` / `readMap`（ADR 0028）

- 任务类型：**feature**（能力缺口证明 + 目标行为验收契约；不虚构 Bug 根因）
- 被审对象：issue #369「W2: lease 公共面 readArray / readMap——四键恒形、元素口径投影文本、✂ 窗口事实（ADR 0028）」
  （brief `wiki/raw/task_issue-369.md`；Parent PR #367；`Blocked by` #368 / #363 / #364）
- Worktree / 基线：`/home/wangjian/nomicore-fix-issue-369`，branch `mabf/issue-369`，
  HEAD `ab6e3908b022292d5af7e800a6452bc392023a9e`（`fix(#368): W1: doc-runtime 载体级窗口原语……(#372)`）
- 本轮 dispatch 明确：「Do not implement code or author executable tests」+「REST Issue-comment read 返回无评论」。
  因此本报告只交付**诊断证据 + 验收契约规格**（含精确用例清单、绑定表、测试路径与 runner 证据）；
  **本轮零新增/修改测试文件、零生产实现改动**。
- 结论：`approve` —— 能力缺口稳定可证（lease 13 键 / runtime 12 键均无窗口面；运行时 `typeof === 'undefined'`；
  类型面 4 处 TS2339；包导出零窗口名目）；依赖边 #368/#363/#364 全部落地且可用；
  契约可按 §12 规格执行（旧实现必红于能力存在性断言，负控全绿）；
  设计自由项（元素口径锚、✂ 窗口事实格式、released/lifecycle 通道）集中为 §12.1 绑定表交 SA1 冻结，
  其中 **B-6 元素口径锚（封闭对象 map）为唯一承重开放项**，SA1 必须做可满足性裁决（见 §15-1）。

---

## 1. Task type and inputs

| 输入 | 用途 | 状态 |
|---|---|---|
| `wiki/raw/task_issue-369.md` | Host task brief：What-to-build、AC1–AC6、Blocked by #368/#363/#364 | 在场 |
| `wiki/raw/task_issue-369_relevant_decisions.md` | SA8 决策摘录（固定位置） | **缺席**（本轮实查不存在） |
| `wiki/raw/task_issue-369_conflict_report.md` | SA8 前置/设计冲突报告（固定位置） | **缺席**（本轮实查不存在） |
| `artifacts/sa8-conflict-gate-issue-369*.md` | SA8 门禁产物 | **缺席**（`ls artifacts` 零命中） |
| `docs/adr/0028-window-read.md` | 主契约：决策 1/2/3/4/5/6/7/8/9 | 在场（HEAD） |
| `docs/adr/0027-readdata-projection-text.md` | 投影文本形态（T1 渲染器 / T2 readData 文本） | 在场（HEAD） |
| `docs/adr/0024-readdata-shape-budget.md` | `depth` / `maxChildrenPerNode` 预算轴语义与「width 是护栏非选择器」分工 | 在场（HEAD） |
| `docs/adr/0016-readdata-semantic-schema-projection.md` | 读取语义 schema 投影与分层（组合在 namespace-runtime） | 在场（HEAD） |
| `CONTEXT.md` L50「形状预算」/ L61–63「窗口读」 | 词条已含窗口读定义 + 护栏 vs 选择器分工句（设计基线已落） | 在场 |
| `packages/{doc-runtime,namespace-runtime,namespace-registry}/AGENTS.md` | 公共面纪律、包边界、验证门 | 在场 |
| `packages/doc-runtime/src/window.ts` + `src/index.ts`（W1，#368 已合并） | 依赖边：载体级窗口原语与类型名目 | 在场且可用（§5） |
| `packages/namespace-runtime/src/{runtime,read-schema-projection,index}.ts` | 组合层现状：12 键 Runtime、投影文本组装、无窗口面 | 在场（缺口处） |
| `packages/namespace-registry/src/{types,lease,index}.ts` | lease 现状：13 键、readData 双重载透传、无窗口面 | 在场（缺口处） |
| 既有测试（doc-runtime 674+ / runtime / registry 全绿） | 基线 + 负控锚（含形状断言收敛门、公共面守卫） | 在场全绿（§4） |

Issue 评论：**0 条**（本轮 REST 实读返回空；dispatch 原文明示「no owner requirements to incorporate」）。
无标签/无 owner override 需并入。

**SA8 产物缺席的处置**（skill：输入缺失时用任务简报、源码、日志和现有测试继续）：
本轮以任务简报 + ADR 0028/0027/0024/0016 + 源码事实 + 现有测试 + 探针证据建立契约；
把本应由 SA8 前置门裁定的设计空白（§12.1 绑定表、§15）显式登记为 **SA1 冻结项**，
不阻塞诊断与契约建立，但阻塞实现前冻结（见 Verdict 条件）。

## 2. Owner comment mapping

- issue #369 评论数 = 0（REST 实读空；无 owner override / 无范围收缩 / 无时序豁免需求）。
- 因此**无 owner 条款需映射**；需求源 = issue body 的 What-to-build + AC1–AC6 + ADR 0028 决策 1/3/6/7/9。
- 与 #368 的差异：本轮不存在「Owner override 范围」问题——#369 的 Blocked by 三条依赖（#368/#363/#364）
  在 HEAD 均已落地（§3/§5），无需豁免即处于可执行状态。

## 3. SA8 constraints（无 SA8 产物时的替代约束面）

| 约束（来源） | 本契约落点 | 证据 |
|---|---|---|
| 决策 1：公共面 = lease 层两方法 `readArray(path,{n,orderBy?,depth?,maxChildrenPerNode?})` / `readMap(path,{…})`；`n` 必填 ≥1 整数 | §12.1 B-1/B-3；§12.2 AC1/AC5 | ADR 0028 L18–22 |
| 决策 3：条目列表 `[{index,value}]` / `[{key,value}]`，身份随行，包装不进 schema 口径，空容器 `[]` | §12.1 B-4；用例组 W2-A | ADR 0028 L37–42 |
| 决策 6：schema = 元素口径投影文本（类型块 + docs；depth 截断标记落元素子树内；路径键控、与数据无关；空容器照常返回） | 用例组 W2-S；绑定 B-6/B-7 | ADR 0028 L56–59；issue body 同义 |
| 决策 7：恒四键 `{ok,value,schema,truncated}`；`truncated === kept < total`；窗口事实（kept n/total N + 基与方向）进 ✂ 段；total=0 → `truncated:false`、无 ✂；三稳定码响亮不抛 | §12.1 B-9；用例组 W2-A/W2-T/W2-F | ADR 0028 L61–68 |
| 决策 9：组合分层——doc-runtime 载体原语（W1，已交付）；namespace-runtime 组合选窗 + 元素口径投影文本；namespace-registry lease 公共面与类型别名；**readData 与 ADR-0024 options 零改动** | §10 影响面；§12.7 红线 | ADR 0028 L75–80 |
| #368 设计移交（W2 对账项）：R3「Y.Map 显式 undefined 值键出条目空间」→ W2 的 total 口径必须与 W1 候选空间一致 | 用例 W2-E3/W2-T；§12.1 B-9 | `wiki/raw/task_issue-368_design.md` §13 R3（L612） |
| #368 设计移交：W1 成功面**恰两键** `{ok,value}`（ADR 0028 决策 7 的四键属 W2 lease 口径）；W1 D3 解释性钉死 = 数组面值键总序 | 本契约不要求 W1 改形；§12.7-1 红线 | `task_issue-368_sa10_spec.md` L32；`task_issue-368_design.md` D3 |
| 模块 AGENTS：公共 API 仅经 `src/index.ts`；公共面守卫逐导出/逐键记账；读保持 schema 无关；读不进 sequencer | §10；§12.7-5/6 | `packages/*/AGENTS.md` |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 环境 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；typescript `5.9.3` |
| 依赖安装 | `pnpm install --frozen-lockfile --prefer-offline` → 65 包全部复用本地 store，0 下载，exit 0 |
| 根 typecheck（基线） | `pnpm typecheck` → **exit 0**，14 个 tsconfig 全过、零输出（`artifacts/sa6-issue369-typecheck.log`） |
| 三包测试（基线） | `vitest run packages/doc-runtime packages/namespace-runtime packages/namespace-registry --typecheck.enabled=false` → **122 文件 / 1642 用例全绿**、exit 0（`artifacts/sa6-issue369-baseline-packages.log`） |
| 根测试（基线） | `pnpm test`（`vitest run --typecheck`）→ **388 文件 / 4668 用例全绿**、`Type Errors: no errors`、exit 0（`artifacts/sa6-issue369-root-test.log`） |
| 测试入口 | `vitest.config.ts` L15 runtime include `packages/*/test/**/*.test.ts`；L20 typecheck include `packages/*/test/**/*.test-d.ts`；`maxWorkers: 1` |
| 本轮新增产物 | 仅诊断日志（`artifacts/sa6-issue369-*.log`）与本报告；**零测试文件、零生产改动**（§16） |

## 5. Positive reproduction（能力缺口复现；feature 的「正例」= 目标能力整体不存在）

**探针**（临时只读脚本，已删除；日志 `artifacts/sa6-issue369-probe.log` + `-run{1,2,3}.log`）：
经真实装配 `createNamespaceRegistryForTesting` + `createNamespaceRuntimeWithSeam` 打开 lease，
schema ready 后对同一 fixture（数组 `workRecords` / `tasks: Record<string,Task>` / `assets: Record<AssetId,Asset>`（keyPattern）/
`meta` 封闭对象 / `emptyTags` / `emptyAssets` / `taskList`）做能力与 oracle 探测。

1. **lease 公共面恰 13 键、runtime 恰 12 键，均无窗口面**（实跑）：

   ```text
   lease.keys   = [bumpReplicationEpoch, enableReplication, getActiveSchema, getMetadata, getSchema,
                   getStatus, mutateData, namespaceId, openReplicationSession, owner, readData,
                   release, replaceSchema]                                   // 13 键，无 readArray/readMap
   runtime.keys = [bumpReplicationEpoch, close, enableReplication, getActiveSchema, getMetadata,
                   getSchema, getStatus, mutateData, namespaceId, owner, readData, replaceSchema]
                                                                            // 12 键，无 readArray/readMap
   lease.readArray.type = "undefined"      lease.readMap.type = "undefined"
   runtime.readArray.type = "undefined"    runtime.readMap.type = "undefined"
   registry.exports.windowish = []         runtime.exports.windowish = []
   lease.readArray.invoke → TypeError: leaseRecord.readArray is not a function
   ```

2. **类型面缺口**（临时 tsc 探针，已删除；`artifacts/sa6-issue369-type-probe.log`）：4 处 `TS2339`
   （`NamespaceLease` / `NamespaceRuntime` × `readArray` / `readMap`），而 `readData` 正/负预算调用零错误
   ——装置敏感（阳性对照编译干净），缺口精确落在两个窗口方法签名与类型别名。

3. **契约形最小红灯探针**（临时 `assert` 脚本，已删除；`artifacts/sa6-issue369-red-probe.log`）：
   先跑负控 **PASS**（readData 恒四键 / W1 原语在场 / W1 三码在场），再跑目标断言 →
   **FAIL 于 `typeof lease.readArray === 'undefined'`**，2/2 轮逐字节相同、exit 1：
   失败原因是能力缺失，零 fixture/环境/入口错误。

4. **依赖边（Blocked by）全部落地且可用**（同探针）：

   ```text
   w1.readArrayWindow    {"ok":true,"value":[{"index":0,"value":30},{"index":2,"value":20}]}   // by:'index' desc（值键总序）
   w1.readMapWindow      {"ok":true,"value":[{"key":"t2",…},{"key":"t3",…}]}                    // field:priority desc
   w1.emptyArrayWindow   {"ok":true,"value":[]}          w1.emptyMapWindow {"ok":true,"value":[]}
   w1.absent             {code:"WINDOW_TARGET_ABSENT",…} w1.carrierMismatch {code:"WINDOW_CARRIER_MISMATCH",…}
   w1.optionsInvalid     {code:"WINDOW_OPTIONS_INVALID",…}
   ```
   - #368（W1）：`readArrayWindowAtPath` / `readMapWindowAtPath` 在场可用，三码 + `PATH_NOT_ALLOWED` 透传就位
     （HEAD `ab6e390`，`packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` 现全绿）；
   - #363（T1）：`renderProjectionText` 已为 `@nomicore/vfsl` 公共导出（commit `f8a06fe`），并经 `readData.schema` 文本可见；
   - #364（T2）：`readData` 成功分支恒四键 + 投影文本（探针 `readData.arrayContainer` 等全部四键）。

## 6. Negative control（当前全绿；实现后必须保持全绿）

| # | 断言 | 证明什么 | 本轮实测 |
|---|---|---|---|
| NC1 | `lease.readData(['workRecords'])` 成功面恰四键 `{ok,value,schema,truncated}`；`schema` 为元素/容器投影文本；`truncated` 反映值通道截断 | readData 冻结面（ADR-0027 决策 1）不被窗口面破坏；装置健康 | 绿（探针 + 契约形红灯探针负控段） |
| NC2 | W1 原语 `readArrayWindowAtPath` / `readMapWindowAtPath` 在场；数组面 `by:'index'` asc/desc = 值键总序 + 下标锚；三码各就各位 | 依赖边冻结面（#368 成功面恰两键、D3/D4）零改动 | 绿（探针；`w1.*` 行） |
| NC3 | `lease.readData` released 短路 → `{ok:false,code:'NAMESPACE_LEASE_RELEASED',message}` | lease 既有 released 通道形状不变 | 绿（`released.readData`） |
| NC4 | `readData` 缺席吸收（缺键 → `{ok:true,schema:null}`；数组越界 → 元素口径 schema + `value:undefined`）与 W1 缺席响亮（`WINDOW_TARGET_ABSENT`）**成对方向相反** | 窗口「不吸收」语义不得回渗 readData；两者互不污染 | 绿（`nc.*` 行） |
| NC5 | 既有全部套件 / 根 typecheck / 根 test 全绿（§4） | 纯加法回归锚；无预存在红 | 绿（388 文件 / 4668 用例 / Type Errors: no errors） |
| NC6 | 形状断言收敛门（`readdata-shape-assertion-consolidation-gate.test.ts`）保持绿——新窗口用例不得把 `{ok,value,schema,truncated}` 字面写死（family A/B） | 新契约测试必须经 `readDataOk` / `expectReadDataOkKeys` 或等价集中化面表达形状（§12.6-3） | 绿（基线） |

## 7. Stability, scale and timing

- **确定性复现**：诊断探针 3/3 轮输出逐字节相同（sha256 `865fdf27…06ad0`，50 行）；红色探针 2/2 轮相同、exit 1。
  纯同步本地读（无时钟/并发/网络/服务），无时序窗口。
- **能力缺口判据**：`typeof` 与调用异常在任意装配下同源（探针经真实 Registry 装配；类型探针独立 tsc 复核）——
  非「偶发 undefined」。
- **规模哨兵（契约将执行、本轮规格化）**：`total` 口径必须经 **O(N) 标识枚举**得出，**不得**为计数而全量物化
  （ADR 0028 决策 8：未入选子项零物化）。契约用例 W2-E3 以 N=2000、未入选项埋 `non-finite` 毒值 +
  `n=2` 作行为哨兵：正确实现 `ok:true`（截断事实 kept 2/total 2000），任何「先全量读再裁剪/计数」的实现必红。
- **性能**：不设墙钟断言（避免 CI 抖动）；成本纪律以行为哨兵锚定（同 #368 决策 8 口径）。
- **时序/环境条件**：零服务、零外部依赖、零 env override；红灯不依赖 `--typecheck` 开关。

## 8. Capability gap chain（feature：能力缺口链）

| Step | 事实 | 证据 | 置信度 |
|---|---|---|---|
| 症状 | 消费方无法一次调用拿到「条目列表值 + 元素口径投影文本 + 截断事实」三元组；只能 `readData` 全量 + 自行裁剪，或直依 doc-runtime 底层原语（非 lease 公共面） | §5-1/§5-3；CONTEXT「窗口读」词条为设计基线、无实现 | 高（实测） |
| 直接缺口 | `NamespaceLease`（13 键）与 `NamespaceRuntime`（12 键）均无 `readArray` / `readMap`；调用 → `TypeError`；类型面 TS2339 | §5-1/§5-2 | 高（实测） |
| 实现层缺口 | `@nomicore/namespace-runtime` 无窗口组合面、`@nomicore/namespace-registry` 无窗口透传/类型别名；两包导出零窗口名目 | §5-1（windowish = []）；`index.ts` 实读 | 高（实测） |
| 触发条件 | 需要「最新 K 条 / 按字段选 K 条 / 稳定平局」的窗口选择，而 readData 的 width 是结构盲护栏（非选择器） | ADR 0028 背景节；CONTEXT L50 分工句 | 高（决策文本） |
| 最深根因（本票） | W2 组合层与 lease 公共面从未交付；W1 已交付但未被组合成 lease 公共面（ADR 0028 决策 9 的第三/第四层缺失） | ADR 0028 决策 9；#368 交付边界（非目标明示排除 W2） | 高（决策 + 依赖实测） |
| 放大因素 | 无窗口面时，消费方要么全量物化（失去零物化成本纪律），要么绕开 registry lease 直依 doc-runtime（失去 lease 生命周期/released 通道与类型契约） | 决策 8/9；registry AGENTS「除 close 外代理全部 Runtime 能力」 | 高 |
| 未证实假设 | **元素口径锚策略**（尤其封闭对象 map）与 ✂ 窗口事实格式无 ADR/issue 明示——见 §12.1 B-6/B-7/B-8 与 §15-1（SA1 冻结项，非本报告矛盾） | 探针 `anchor.metaKeyLiteral → schema:null` 反证 `[...path,'<key>']` 不覆盖封闭对象 | 高（实测） |
| 已排除项 | 依赖未落地、能力已存在但命名不同、红灯因环境/fixture/入口 —— 见 §11 | §11 | 高 |

## 9. Causal experiments（控制变量 / 反证）

1. **同场景控制变量**：同一次装配中 13 个 lease 键、12 个 runtime 键全部在位（含 `readData` 函数），
   仅 `readArray`/`readMap` 为 `undefined`（类型面亦仅这 4 处 TS2339）——差异只可能是窗口能力缺失，
   排除安装/条件导出（`nomicore-source` 条件生效，readData/W1 均可用）。
2. **fixture 健全性**：同一 fixture 经 `readData` 全量读得到预期普通值（NC1/NC4 绿）；
   W1 两条原语在同一 doc 上选出正确窗口（NC2 绿）——红灯不来自 Yjs 构造、路径写错或载体选择。
3. **组合可行性（AC4 等价锚现状）**：W1 入选项物化与同预算 `readData(项路径).value` 已逐项相等
   （`equiv.array` / `equiv.map` 全 `equal:true`，JSON 逐字节）——W2 只需组合/包装，**无需改 W1**；
   等价锚不是空想，是现状事实。
4. **元素口径 oracle 可行性（AC2）**：`readData([...path, 锚段], 同预算).schema` 就是渲染器对元素口径的输出：
   - 数组锚 = 数值 `0`：`workRecords.0` → `number`；`taskList.0` depth:0 → `Task‡` + `‡` 页脚、
     depth:1 → `Task` 块 + 字段 docs（depth 截断标记落元素子树内）；
   - 空容器数据无关性：`emptyTags.0` → `string`、`emptyTasks.0` → `Task`（无数据照常返回元素口径）；
   - Record 锚 = 字面 `<key>`：`tasks.<key>` / `assets.<key>`（keyPattern 载体）/ `emptyAssets.<key>`
     一律解析到元素类型 `Task`/`Asset`——**逐一命中元素子树语义**；
   - 反证（承重）：封闭对象 map `meta.<key>` → `schema:null`（无 `<key>` 槽），
     而 `meta` 容器路径 → `{content: string; extra: number}` 整块、depth:0 → `[...]‡`。
     ⟹ 「一个锚打天下」不成立；B-6 必须按载体 schema 形状冻结策略（§12.1/§15-1）。
5. **分层对偶实验**：`readData` 缺席吸收（`{ok:true}`）与 W1 缺席响亮（`WINDOW_TARGET_ABSENT`）同场方向相反，
   证明两类语义物理分离、互不寄生；lease 窗口面必须走 W1 的响亮语义（AC5）。
6. **计数策略判别实验（规格化）**：若组合层以「全量 `readData` 容器读后计数」实现 `total`，
   在 N=2000 毒值 fixture 上必红（readData 值通道遇 non-finite 响亮失败）；
   以 O(N) 标识枚举实现则 `ok:true`——用例 W2-E3 即该判别器（§7/§12.2）。

## 10. Impact surface

| 面 | 预计改动 | 约束 |
|---|---|---|
| `packages/namespace-runtime/src/runtime.ts` | Runtime 公共面 12 → 14 键（+`readArray`/`readMap`）；组合 W1 原语 + `projectReadDataSchema` 等价投影文本 + 四键结算 + `truncated = kept<total` | 读不进 sequencer；lifecycle gate 同 readData；不改 readData |
| `packages/namespace-runtime/src/index.ts` | type-only 追加窗口 options/结果类型别名（值导出仍恰 `RuntimeWriteFatalError` 一键） | 公共面仅经 index；导出审计测试 |
| `packages/namespace-registry/src/types.ts` | `NamespaceLease` +2 方法；`NamespaceLeaseReadArray/ReadMap{Options,Result}` 别名（= runtime 别名 \| released issue） | 类型别名跟随（Equal 锁） |
| `packages/namespace-registry/src/lease.ts` | 两方法 released 短路 + active 期 raw 引用透传；Equal 锁新增两对 | 「原样透传」断言锚（同 readData 先例） |
| `packages/namespace-registry/src/index.ts` | type-only 追加两方法结果/options 别名 | 值导出面不变 |
| **既有守卫测试（必须同步更新）** | `runtime-close-lifecycle.test.ts`(12 键) / `runtime-phase5-reset-fence-r2.test.ts`(12 键) / `runtime-registry-internal-seam.test.ts`(12 键) / `registry-open.test.ts`(13 键)；`registry-data-interface.test-d.ts`、`runtime-data-interface.test-d.ts`、`runtime-registry-internal-type-guard.test-d.ts` 类类型面 | 纯加法：既有 13/12 键必须全数保留；新增键恰 2 |
| 形状断言收敛门 | 新窗口用例**不得**字面写死 `{ok,value,schema,truncated}`；用 `expectReadDataOkKeys` / `readDataOk` 或经 SA1 同意扩 helper 的集中化面 | `readdata-shape-assertion-consolidation-gate.test.ts` 保持绿（NC6） |
| 文档面（AC6） | `.agents/skills/nomicore/typed-access.md`「Read result」段后补窗口读消费段 + 与 readData 预算分工句；`docs/integration/cordis-plugin-hosting.md`「创建、读取、修改和重新打开」区补同款段 | docs/AGENTS：链接/术语核对、`git diff --check`；CONTEXT 词条已存在（零改动或随措辞对齐） |
| 冻结面（零改动） | `packages/doc-runtime/**`（W1 成功面恰两键、三码 + PATH_NOT_ALLOWED、D3/D6 语义）；`readData` 与 ADR-0024 options；ValueSchema/wire/持久化/诊断日志 | §12.7 红线 |

## 11. Ruled-out hypotheses

| 假设 | 结论 | 反证 |
|---|---|---|
| 1. 窗口能力已存在，只是命名/绑定不同 | **排除** | lease/runtime `typeof` 均 `undefined`；两包导出过滤 `array\|map\|window` 零命中；两接口 tsc TS2339 ×4 |
| 2. Blocked by 未满足（#368/#363/#364 未落地） | **排除** | HEAD 含 #368（`ab6e390`）；T1 渲染器 commit `f8a06fe`；readData 四键文本形态实测在产（§5-4） |
| 3. 红灯来自环境/安装/测试入口 | **排除** | 同次运行 388 文件 / 4668 用例全绿、`Type Errors: no errors`；装置负控 PASS 后目标断言才 FAIL |
| 4. fixture 构造错误导致的能力假象 | **排除** | 同 fixture 经 readData 全量读与 W1 原语均得预期值（NC1/NC2/NC4） |
| 5. W1 与 ADR 0028 冲突（数组面 `by:'index'` 值键 vs 注释「自 [0] 取」） | **非本票冲突面** | #368 SA8 iteration 3 已裁 no-conflict（解释性钉死）+ SA2 独立重算；W2 继承 W1 冻结语义（§15-8） |
| 6. 「四键」与 W1 成功面两键冲突 | **排除（分层）** | ADR 0028 决策 7 四键是 lease 口径；#368 设计明示 W1 成功面恰两键、W2 组合升级四键；本契约不要求改 W1 |
| 7. 契约可以源码字符串/正则断言替代行为验证 | **排除** | 本契约全部断言锚定运行时结果联合、条目列表、schema 文本、type-level 签名；零 grep/源码文本断言 |
| 8. 负控是伪绿（fixture 不触发目标路径） | **排除** | 红色探针先跑负控（真触发 readData/W1/三码）再跑目标断言；两者同装配同 doc |

## 12. Acceptance contract and test paths

> 本轮 dispatch：不实现代码、不编写可执行测试。本章给出**可直接落地的用例规格**（输入、可观察断言、旧实现预期、
> 目标预期、绑定表、入口），供后续 dispatch（SA6 补测 / SA3 实现）逐条转写为测试文件。

### 12.1 契约绑定表（SA1 冻结；语义断言不随绑定变化）

| # | 绑定 | 契约默认取值 | 依据 / 若 SA1 另择的处置 |
|---|---|---|---|
| B-1 | lease 方法名 | `readArray` / `readMap` | ADR 0028 决策 1（**冻结名，非自由**）；参数 `(path, options)` |
| B-2 | runtime（组合层）方法名 | 同名 `readArray` / `readMap` | ADR 0028 决策 9 分层；若 SA1 冻结不同名，只改测试适配器常量 |
| B-3 | options 类型 | 复用 doc-runtime `ReadArrayWindowOptions` / `ReadMapWindowOptions`（type-only 别名：`NamespaceRuntimeReadArrayOptions` 等）；**第二参必填**（`n` 必填、无重载） | ADR 0028 决策 1/2；doc-runtime 单源类型零复制先例（readData options 同款） |
| B-4 | 结局面 | 成功恰四键 `{ok,value,schema,truncated}`（`value` = 条目列表）；失败 = W1 失败成员原样 `{ok:false,code,path,message}` \| runtime `RUNTIME_READ_DISABLED` \| lease `NAMESPACE_LEASE_RELEASED` | 决策 7 + W1 现状 + readData 通道先例；测试只锁成功键集与失败 code，不锁 message |
| B-5 | 公共别名名 | `NamespaceRuntimeReadArray{Options,Result}` / `NamespaceRuntimeReadMap{Options,Result}`；`NamespaceLeaseReadArray{Options,Result}` / `NamespaceLeaseReadMap{Options,Result}`；lease 结果 = runtime 结果 \| `NamespaceLeaseReleasedIssue` | namespace-registry「别名跟随 + Equal 锁」先例（`_readAlias`/`_readBudgetAlias`）；改名只动类型守卫断言 |
| B-6 | **元素口径锚策略** | 数组面（Y.Array/plain array）：`[...path, 0]`；键面 **`<key>` 槽存在**（Record 形）：`[...path, '<key>']`；键面**封闭对象形**（`YMap<{…}>`/plain object 静态键）：**SA1 必裁**（候选见 §15-1） | 决策 6「路径键控、与数据无关」；实测：数组 0 ✓、Record `<key>` ✓（含 keyPattern 与空容器）、封闭对象 `<key>` → `schema:null` ✗。**最高风险绑定** |
| B-7 | schema 文本组成 | **默认 D1：无头行**——`schema = renderProjectionText(resolve(锚), 预算)` 正文 +（kept<total 时）✂ 窗口事实行；**默认不携带项级值通道 truncations**（`‡` 页脚来自 schema 侧 depth） | AC2「schema 文本 ≡ 渲染器对元素口径的输出」在 D1 下可字面成立；备选 D2（镜像 readData 头行 `# readArray [...]`）需同步改 AC2 oracle（比较正文段）。SA1 冻结 |
| B-8 | ✂ 窗口事实格式 | 默认与渲染器同段：`✂ 截断事实：` + 行 `- <path> · 窗口 · 基 <index\|key\|field:name> <asc\|desc> · kept <n>/total <N>`；kept===total 或 total=0 → 无 ✂ 段 | 决策 7「窗口事实（kept n/total N + 基与方向）进 ✂ 段」；issue「✂ 窗口事实段」。SA1 冻结后转 Byte 级断言；未冻结前用 token 级断言（§12.6-2） |
| B-9 | `truncated` / `total` | `truncated === (value.length < total)`；`total` = W1 条目空间候选数（数组 = 长度；Y.Map = `get(k)!==undefined` 键数；plain object = own-enumerable data 键且值非 undefined；稀疏空洞计入） | issue body 逐字 + 决策 7 + #368 R3/P4；测试用「独立预言机计数」对账（§12.6-4） |
| B-10 | released / lifecycle 通道 | lease released → `NAMESPACE_LEASE_RELEASED` issue（先于一切透传、零 doc 触碰）；runtime lifecycle≠ready → `RUNTIME_READ_DISABLED`（零 options 读取、零 doc 触碰）；active 期 path/options **raw 引用透传** runtime | readData 同款先例（lease.ts L284–297；runtime.ts readData S1/S2a）；SA1 冻结 |
| B-11 | 既有守卫更新义务 | runtime 键集 12→14、lease 13→15；既有键全数保留；值导出面不变 | §10 影响面；属实现义务非自由项 |

### 12.2 Issue AC ↔ 可执行用例组映射

| Issue AC | 用例组 | 关键可观察断言 |
|---|---|---|
| AC1 恒四键 own 键集；条目列表（身份随行、有序基之序）；空容器 `value:[]` + 元素口径 schema + 无 ✂ | **W2-A**：A1 数组四键+两条目形；A2 键面四键+两条目形；A3 四类空容器（空标量数组/空对象数组/空 Record/空 Y.Map）；A4 基×方向矩阵；A5 身份回环；A6 包装不进 value/schema | `expectReadDataOkKeys(r)`；条目 own 键恰 `['index','value']`/`['key','value']`；`toStrictEqual` 条目列表；`value=[]` 时 `schema` 非 null 且 `✂` 不在场、`truncated:false` |
| AC2 schema 文本 ≡ 投影文本渲染器对元素口径的输出 | **W2-S**：S1 数组元素 oracle（标量/对象；depth 0/1/2）；S2 Record 元素 oracle（普通/keyPattern/空）；S3 数据无关性（空 vs 满、不同 n、两次调用）；S4 封闭对象策略（B-6 冻结后）；S5 docs/别名在场 | D1（B-7 默认，无头行）下：`window.schema` 去掉窗口事实行后与 `readData(锚, 同预算).schema` 的**正文 + `‡` 页脚**逐字节相等；若 SA1 冻结 D2，则比较双方「首个空行之后」的正文段；`Task‡`（depth 耗尽）位置在元素子树内；字段 docs `// 任务标题`、`type Task = {…}` 在场；空容器与满容器 schema 逐字节相等 |
| AC3 ✂ 段呈现 kept/total + 基与方向；`truncated` 与之一致 | **W2-T**：T1 kept<total（数组/键面/字段基）；T2 kept===total；T3 total=0；T4 n=1 / desc | `truncated === (value.length < total)`（预言机 total）；`schema` 含 `✂` 与 `kept <n>`/`total <N>` 与基/方向 token；T2/T3 时 `✂` 不在场 |
| AC4 组合式 depth 等价：入选项物化 ≡ 同预算 `readData(项路径)` 逐字节 | **W2-E**：E1 `{depth:0/1/2}` 数组+键面；E2 `maxChildrenPerNode` 只治项内部；E3 N=2000 毒值零物化哨兵（`ok:true`，kept 2/total 2000）；E4 入选毒项 fail-fast（`PATH_NOT_ALLOWED`，无半窗） | 每条目 `toStrictEqual(entry.value, readData([...path, 身份], opts).value)`；E3 `ok:true`（任何全量物化实现必红）；E4 `code/path/message` 非空且无部分窗口 |
| AC5 三失败码经 lease 透传形状语义不变；registry lease 类型别名与透传断言 | **W2-F**：F1 三码逐字（absent/mismatch/options invalid）；F2 `PATH_NOT_ALLOWED` 透传；F3 released；F4 lifecycle≠ready；F5 raw 引用透传（spy runtime 记录实参引用同一性）；F6 lease≡runtime 逐字段 | 与直调 W1 结果 `toStrictEqual`；released → `NAMESPACE_LEASE_RELEASED`；`RUNTIME_READ_DISABLED` 形状同 readData；spy 捕获 `options === 传入引用`、path 引用同一 |
| AC6 作用域文档段落与负控绿；root typecheck/test 全绿 | **W2-Y + W2-NC + 文档** | Y1 类型面（§12.2 类型用例）；Y2 公共面守卫（12→14 / 13→15）；Y3 值导出不变；NC1–NC6 全绿；文档段落含「与 readData 预算分工」句；`pnpm typecheck` / `pnpm test` 绿 |

**类型层用例 Y1**（`*.test-d.ts`）：
- `NamespaceRuntime['readArray']` / `NamespaceLease['readArray']` 签名 = `(path, options) => Result`（第二参必填）；
- `Equal<NamespaceLeaseReadArrayResult, NamespaceRuntimeReadArrayResult | NamespaceLeaseReleasedIssue>`（lease Equal 锁同款）；
- `Equal<NamespaceRuntimeReadArrayOptions, ReadArrayWindowOptions>`（doc-runtime 单源）；
- 成功成员 `keyof` 恰 `'ok'|'value'|'schema'|'truncated'`；`schema: string|null`；
- 负例（`@ts-expect-error`）：`readArray(path)` 缺 options；`readArray(path,{n:0})`（可选，若类型层不收窄则运行时断言）；`readArray` 传 `{orderBy:{field:'x'}}`（词表外）；`readMap` 传 `{orderBy:{by:'index'}}`。

### 12.3 最小输入与期望（旧实现 vs 目标实现）

**最小 fixture**（内联于契约测试；建议同步抽 `*-fixture.ts` 供红/控制两套共用）：

```vfsl
type AssetId = string & Pattern<"^[A-Za-z0-9_\\-]{1,64}$">;
type Task = YMap<{ /** 任务标题 */ title: YLeaf<string>; /** 优先级（数值越大越优先） */ priority: YLeaf<number>; }>;
type Asset = YMap<{ /** 资源名 */ name: YLeaf<string>; }>;
type ROOT = YMap<{
  /** 工作记录（append 日志） */ workRecords: YLeaf<number>[];      // [30,10,20]
  /** 任务表（Record 键空间） */ tasks: Record<string, Task>;        // t1(2) t2(9) t3(5)
  /** 资源索引（Record + keyPattern） */ assets: Record<AssetId, Asset>; // a1 b2
  /** 空 Record */ emptyAssets: Record<string, Asset>;                // {}
  /** 封闭对象 map */ meta: YMap<{ content: YLeaf<string>; extra: YLeaf<number>; }>; // hi/7
  /** 任务数组 */ taskList: Task[]; /** 空任务数组 */ emptyTasks: Task[];
  /** 空标量数组 */ emptyTags: YLeaf<string>[];
}>;
```

- **最小调用**：`lease.readArray(['workRecords'], { n: 2, orderBy: { by: 'index', dir: 'desc' }, depth: 1 })`；
  `lease.readMap(['tasks'], { n: 2, orderBy: { field: 'priority', dir: 'desc' }, depth: 1 })`。
- **目标期望**：成功 → 恰四键；`value` = 有序基前 `min(n,total)` 条目（`{index,value}` / `{key,value}`）；
  `schema` = 元素口径投影文本（B-6/B-7）；`truncated === kept < total`（B-9）；失败 → W1 失败成员原样。
- **旧实现（HEAD `ab6e390`）对照**：`typeof lease.readArray === 'undefined'` → 目标断言**全部红于能力存在性**
  （`TypeError: lease.readArray is not a function` / 类型面 TS2339）；负控（readData / W1 / 三码）全绿。
  任何以别名、doc-runtime 直挂或内部函数冒充的实现，会在 W2-F5（lease 透传同一性）/ W2-Y（类型别名）/
  W2-A1（四键）处同样红。

### 12.4 负控（必须保持绿）

§6 表 NC1–NC6；其中 NC1/NC2/NC3 锁 readData 与 W1 冻结面，NC4 锁「窗口响亮 vs readData 吸收」对偶，
NC5 锁全网基线，NC6 锁新测试的形状断言纪律（经集中化 helper 表达四键）。

### 12.5 边界与非目标（不得越界）

- **非目标**：`packages/doc-runtime/**` 任何改动（W1 成功面恰两键、三码词表、D3/D4/D5/D6 语义）；
  `readData` 与 ADR-0024 options 形状/语义；ValueSchema 联合；wire/持久化/诊断日志；
  #370 及后续票的未知范围（本 brief 未定义，不在本契约）。
- **本契约不锁的设计自由**（SA1 冻结前不得写成断言）：
  message 文案；`n` 上限（除 ≥1 有限整数外）；`orderBy.dir` 缺省实现细节；
  多字段/嵌套路径/readArray 属性排序/n=0 计数探针（ADR 0028 开放问题）。
- **不得发生**：`WINDOW_TARGET_ABSENT` 缺席吸收语义回渗 readData；窗口面借 readData 的 width 轴做终点裁剪；
  为计数而全量物化；在 lease 层复制第二份 options 校验（透传纪律）。

### 12.6 敏感度与伪绿防线

1. **精确等值**：条目列表 `toStrictEqual` + 失败 code 严格字符串相等；无 `expect.anything()`、无吞错、无 skip/only。
2. **格式未冻结期**：✂ 窗口事实用 token 断言（`✂`、`kept <n>`、`total <N>`、基 token、方向 token）+
   `truncated === kept < total` 预言机；SA1 冻结 B-8 后升级为整段 Byte 断言（测试内单点常量）。
3. **形状断言集中化**：四键 own 键集经 `expectReadDataOkKeys`（`packages/namespace-runtime/test/helpers/readdata-ok-shape.ts`）
   或 SA1 认可的等价集中化面表达——否则 `readdata-shape-assertion-consolidation-gate.test.ts` 的
   family A/B（AST 扫描）会把新用例判为未集中化而红（NC6）。全值断言用 `expectReadDataOk`（期望值独立内联构造）。
4. **`total` 反漂移**：每个用例以**独立预言机**计算 total（数组长度 / 条目空间键数），断言
   `truncated === (value.length < total)`；并含一条「显式 undefined 值键出条目空间」用例（#368 P4 对账，W2 边界）。
5. **零物化哨兵**：W2-E3（N=2000 毒值）是「不得全量物化」的行为判别器（§7/§9-6）。
6. **oracle 不漂移**：AC2 的期望由同一次运行中的 `readData(锚, 同预算)` 公共面产出（不是测试内硬编码字符串），
   渲染器与组合层任一侧漂移即红；同时 S3 以「空 vs 满容器 schema 逐字节相等」验证数据无关性。

### 12.7 实现期红线（交 SA1/SA3/SA7 复核，非本契约执行）

1. `packages/doc-runtime/**` 零改动（W1 成功面恰两键与三码词表冻结；read.ts 零 diff 纪律延续）。
2. readData 与 ADR-0024 options 零改动；窗口 options 校验不得借 readData 通道。
3. 公共 API 仅经各包 `src/index.ts`；值导出面不变（runtime 恰 `RuntimeWriteFatalError` 一键）。
4. 既有键全数保留（runtime 12→14、lease 13→15），同步更新 §10 所列守卫测试。
5. 读不进 sequencer、零 doc 触碰先于 options 校验/lifecycle gate 顺序按 B-10。
6. 文档两处（typed-access / cordis-plugin-hosting）补窗口读段 + 与 readData 预算分工句；CONTEXT 词条零漂移。
7. 不得为过契约修改本报告所述的语义断言；若 SA1 冻结不同绑定（B-2/B-5/B-6/B-7/B-8），
   只允许改测试内绑定常量/适配器并回写本节与 §12.1。

### 12.8 测试路径（本轮**未**创建；供后续 dispatch 落地）

| 路径 | 内容 | 采集 |
|---|---|---|
| `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts` | 主契约：W2-A/S/T/E/F/NC（经真实 Registry 装配 + lease 公共面；fixture 内联或同目录 `issue-369-window-read-fixture.ts`） | `packages/*/test/**/*.test.ts`（vitest.config.ts L15） |
| `packages/namespace-registry/test/issue-369-window-read-lease-surface.test-d.ts` | 类型层 Y1：签名/别名 Equal 锁/负例 | `packages/*/test/**/*.test-d.ts`（L20） |
| `packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts`（可选，SA1 定） | 组合层本地面：lifecycle gate、oracle、E3 哨兵（不绕 registry） | 同上 L15 |

（本轮按 dispatch 零测试落盘；上述路径仅规格。）

## 13. Red/green evidence

| 运行 | 命令 | 结果 |
|---|---|---|
| 能力/ oracle 探针 | `NODE_OPTIONS=--conditions=nomicore-source tsx <probe>`（临时脚本，已删除） | 3/3 轮逐字节相同（sha256 `865fdf27…06ad0`）；lease 13 键 / runtime 12 键无窗口面；`typeof` 双 `undefined`；调用 `TypeError`；W1/readData oracle 全绿（§5） |
| 契约形红灯探针 | 同装配 + `node:assert`（临时脚本，已删除） | 负控 **PASS** → 目标断言 **FAIL** 于 `typeof lease.readArray === 'undefined'`；2/2 轮相同、exit 1（`artifacts/sa6-issue369-red-probe.log`） |
| 类型探针 | `tsc --noEmit -p <临时 tsconfig>`（已删除） | `NamespaceLease`/`NamespaceRuntime` × `readArray`/`readMap` = **TS2339 ×4**；`readData` 阳性对照零错误；exit 2（`artifacts/sa6-issue369-type-probe.log`） |
| 基线（三包） | `vitest run packages/doc-runtime packages/namespace-runtime packages/namespace-registry --typecheck.enabled=false` | **122 文件 / 1642 用例全绿**，exit 0 |
| 基线（根 typecheck/test） | `pnpm typecheck`；`pnpm test` | typecheck **exit 0**；root **388 文件 / 4668 用例全绿、Type Errors: no errors**、exit 0 |
| 负控 | 同上 | NC1–NC6 全绿（§6）；红色探针的负控段与目标段同装配对照 |

**旧实现失败点（目标契约的首个红灯位）**：能力存在性断言（`typeof lease.readArray === 'function'` /
类型面 TS2339）——所有 AC1–AC5 目标断言在旧实现下**均不可达**（方法缺席），符合「红在能力缺失而非环境/fixture/超时/入口」。
**本轮未落盘红色测试文件**（dispatch 约束）；红灯以两条可复现探针（运行时 + 类型面）固定证据，
后续转写为 §12.8 契约文件时，首个红因逐字为：

```text
AssertionError: W2 能力缺口：lease.readArray 应为公共方法（ADR 0028 决策 1）——实际 undefined:
  expected 'undefined' to be 'function'
```

## 14. Runner trigger evidence

- **include 正则**（实读 `vitest.config.ts`）：
  - L15 runtime：`packages/*/test/**/*.test.ts`——拟议 `packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts`
    与 `packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts` 均命中；
  - L20 typecheck：`packages/*/test/**/*.test-d.ts`——拟议 `issue-369-window-read-lease-surface.test-d.ts` 命中。
- **采集实证**：`vitest list packages/namespace-registry packages/namespace-runtime --filesOnly` → **107 个文件被采集**
  （91 个 `test/*.test.ts` + 16 个 `*.test-d.ts`，含既有 `issue-347/349/350-*.test.ts` 同目录同模式文件）
  （`artifacts/sa6-issue369-runner-list.log`）；三包基线运行报告 122 文件、根运行 388 文件——
  拟议路径与既有被采集文件同一 glob 形态。
- **零 skip/only/todo、零 env override**：本轮无测试文件；既有基线运行零 skip/only。

## 15. Unknowns and blockers

1. **【承重，SA1 必裁】B-6 元素口径锚策略（尤其键面封闭对象形）**。实测：
   - 数组/Record+keyPattern/空 Record → `[...path, 0]` / `[...path, '<key>']` 均解析出元素口径（含空容器、含 keyPattern 绕过）；
   - 封闭对象 `YMap<{…}>` → `[...path,'<key>']` = `schema:null`；容器路径 = 整块对象（depth 语义从容器起算，与「depth 截断标记落元素子树内」错位）。
   候选策略：(a) 封闭对象走容器路径（接受 depth 从容器起算，issue 措辞需解释）；(b) 按 `orderBy.field`/被选键逐项解析再合成 union（新增组合层合成语义，可能需 vfsl 支持或暴露 resolver 细节）；
   (c) 若封闭对象窗口被判定为非目标，需在 issue/ADR 显式收窄载体词表（ADR 说 readMap 收 Y.Map/plain object，收窄即设计变更）。
   **SA1 必须给出可满足性裁决并回写 §12.1 B-6**；若三条均不可接受，应触发设计层升级（SA8/issue 修订），不得实现期临场发明。
2. **B-7/B-8 文本形态**：schema 是否含头行、窗口事实行格式、项级值截断事实是否入 ✂ 段（issue 只钉 `truncated === kept < total`）。
   默认 D1/默认格式见 §12.1；SA1 冻结后把 §12.6-2 的 token 断言升级为 Byte 断言。
3. **`total` 单源化**：W1 不返回 total（成功面恰两键冻结），组合层必须自算候选计数；若实现以全量 `readData` 计数，
   W2-E3 哨兵必红。SA1 需明确计数实现路径（O(N) 标识枚举）并保持与 W1 D6（undefined 值键出条目空间）一致。
4. **released / lifecycle 通道**（B-10）：默认沿 readData 先例；若 SA1 另有裁决（如窗口在 lifecycle≠ready 直接返回 W1 码），
   需同步改 §12.2 F3/F4 与类型别名。
5. **SA8 产物缺席**（§1）：无 `task_issue-369_relevant_decisions.md` / `_conflict_report.md` / design / conflict-gate。
   本报告以 ADR + brief + 源码 + 探针自建约束面；若 SA8 后续补门禁，需与本报告 §12.1 对账。
6. **`n` 上界与 `MAX_SAFE_INTEGER`**：W1 接受任意有限整数 n；契约不设上界断言，但 E3 哨兵隐含「n 不得触发全量物化」。
7. **文档措辞**：AC6 要求的窗口读消费段需与 CONTEXT「窗口读」词条零漂移（尤其「预算护栏 vs 选择器」分工句）。
8. **W1 D3 残余风险（R1，不阻塞）**：数组面 `by:'index'` = 值键总序为 #368 解释性钉死；若后续 Owner/SA2 改采纯位置读法，
   W2 契约的数组面排序期望需随 #368 契约 A 组同步修订（W2 不单独裁决）。

**无阻塞项**：能力缺口稳定可复现（3/3 + 2/2），依赖边全部落地，负控全绿，契约可执行，
入口与绑定面明确 → 可进入设计（SA1）冻结 §12.1 后实现。

## 16. Temporary diagnostics cleanup

- **零生产实现改动**：`git status --short` 仅显示本报告与诊断日志及 Host 既有未跟踪输入
  （`wiki/raw/task_issue-369.md`）；`packages/**/src/**`、`docs/**`、`vitest.config.ts` 对 HEAD 零改动。
- **临时诊断已全部删除**：
  - `packages/namespace-registry/probe-369.ts`（能力/oracle 探针）→ 已删除；
  - `packages/namespace-registry/probe-369-red.ts`（契约形红灯探针）→ 已删除；
  - `packages/namespace-registry/.probe-369/`（类型探针 + tsconfig）→ 已删除；
  - `.scratch/issue-369/probe.ts`、`.scratch/type-probe/`（首版探针副本）→ 已删除；
  - 复核 `ls packages/namespace-registry | grep probe` 与 `find -name "*probe-369*"` 均零命中。
- **保留证据（仅日志，不含可执行探针源码）**：`artifacts/sa6-issue369-{probe,probe-run1..3,red-probe,red-probe-run1..2,type-probe,baseline-packages,typecheck,root-test,runner-list}.log`。
- **零服务/后台残留**：探针为同步脚本，无服务、无 nohup/setsid/PID 文件/轮询 marker；`job_list` 中后台命令均已结算。
- 收尾核对：本报告写入固定路径 `wiki/raw/task_issue-369_sa6_contract.md`；无其它新增产物。

---

## Verdict

**approve（附 SA1 冻结条件）** —— issue #369 W2 的能力缺口稳定可证（lease 13 键 / runtime 12 键均无窗口面；
运行时 `undefined` + `TypeError`；类型面 TS2339 ×4；两包导出零窗口名目），红灯精确落在「能力存在性」而非环境/fixture/
超时/入口；三条 Blocked by 依赖（#368/#363/#364）在 HEAD 全部落地且可用；AC4 等价锚与 AC2 元素口径 oracle
在现状代码上已可产出（探针实证），AC1/AC3/AC5 的断言面经负控（NC1–NC6）与哨兵设计锚定；契约可按 §12 规格执行，
测试路径与 runner 采集证据真实（§12.8/§14）。
设计自由项（B-2/B-5/B-6/B-7/B-8/B-10）集中为绑定表交 SA1 冻结，其中 **B-6 元素口径锚（封闭对象 map）为唯一承重开放项**：
SA1 必须给出可满足性裁决并回写 §12.1，必要时触发设计层升级——在此之前不得进入实现。
本轮按 dispatch 未实现代码、未编写可执行测试；诊断与契约证据完整、可复核。
