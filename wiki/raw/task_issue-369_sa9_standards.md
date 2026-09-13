# SA9 Standards Review（仓库与工程标准轴）— Issue #369 W2：lease 公共面 `readArray` / `readMap`（ADR 0028 缝 2）

- 派发：`sa-d59b31a6-ef97-4eea-a75e-dbaf8a1b6327`（role `mabf-sa9`，phase `standards-review`，iteration 0）
- **Verdict：`approve`**（无 BLOCKER、无 MAJOR；MINOR 4 项不阻断，见 §7）
- 审查对象：对 HEAD `ab6e3908b022292d5af7e800a6452bc392023a9e`（母 PR #367 权威头，已核对无需 rebase）的**未提交最终交付 diff**——22 个 tracked 修改（+438/−38）+ 5 个新代码/测试文件（`window-read.ts` 742 行、两契约测试 452+890 行、fixture 308 行、类型契约 150 行）+ 证据日志与 wiki 产物
- Worktree：`/home/wangjian/nomicore-fix-issue-369`，branch `mabf/issue-369`；未提交态系本票交付形态（commit/push/PR/finalize 不属本角色）
- Owner 授权：issue #369 REST 评论实读为 **0 条**（dispatch 原文明示）——无 owner 条款需映射；需求源 = issue body What-to-build + AC1–AC6 + ADR 0028 决策 1/3/6/7/9
- 审查方式：静态实读 + 只读命令独立复核（`git diff` 范围核对 / `git diff --check` / DENY 面 `git status` / 全仓 grep / W1 复制件逐函数对账 / canonical 判据逐条比对 / vitest·tsconfig·CI 入口实读）。**未运行测试、未启动服务、未修改任何代码/设计/测试**——绿证据采信已落盘的 SA3/SA4/SA7 报告与 artifacts 日志并抽验其自洽性

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `wiki/raw/task_issue-369.md`（Issue #369 正文 + AC1–AC6；Comments 空） | 已读 |
| 母法 `docs/adr/0028-window-read.md`（决策 1–9、备选、验收三缝、开放问题） | 已读（HEAD 在库，零 diff） |
| ADR 0027（投影文本形态/✂ 段文法/已知限制）、ADR 0024/0016/0008/0009 | 已读相关条款 |
| 设计 `task_issue-369_design.md`（SA1 F-1 修订版，452 行；B-1…B-11、§7.2 B-6、§7.3 S1–S6、§7.4、§11 ALLOW/DENY、§14 评审修订映射） | 已读全文 |
| SA8 设计后冲突复查 `task_issue-369_design_conflict_report.md`（iteration 0，verdict **clear**——19 项对照 12 no-conflict + 7 implements；RA-1–RA-5 实现期义务） | 已读 |
| SA2 评审（iteration 1 原位更新版，verdict **approve**；iteration 0 唯一 MAJOR = F-1 已销项） | 已读 |
| SA6 验收契约（**approve 附冻结条件**；§12.1 B-1–B-11、§12.2 用例组 W2-A/S/T/E/F + Y1、§12.6 防线、§12.8 测试路径） | 已读 |
| SA3 实现报告（iteration 1，F-369-1 返工轮；变更清单/偏差申报/红绿证据索引） | 已读 |
| SA4 静态审查（iteration 1，verdict **approve**；F-369-1 修复核验 + 9 项非阻断观察 O-1…O-9） | 已读 |
| SA7 动态验证报告（**approve**；root 391 文件/4722 用例 + Type Errors: no errors + 探针 7/7 + SA4 §11 三项动态项全兑现） | 已读 |
| 模块 `AGENTS.md`（root / namespace-runtime / namespace-registry / docs） | 已读（注入 + 实读） |
| 交付实现与测试全部文件（`window-read.ts` 全文；`runtime.ts`/`read-schema-projection.ts`/两包 `index.ts`/`types.ts`/`lease.ts` diff；三契约文件 + fixture + test-d 全文；8 个替身/守卫 diff；两文档 diff） | 已读/独立复核 |
| 证据日志 `artifacts/sa3-issue369-f369-1-*.log`、`sa7-issue369-*.log` | 实读抽验 |

## 2. 独立复核（非转述 SA 声明）

| 复核项 | 命令/方法 | 实测结果 |
|---|---|---|
| diff 范围 == 设计 ALLOW + 申报偏差 | `git diff --stat HEAD` + 逐路径对账 | 22 tracked 修改中 14 个精确命中 ALLOW 条目；8 个（`ws-replication/src/testing.ts` + 7 个 registry 测试替身）为接口扩张（12→14/13→15 键）编译强迫的**替身补成员**——SA3 已申报、SA4 §6 已复核必要/最小/语义惰性（恒 `PATH_NOT_ALLOWED` 替身或 `bind` 委托，零断言语义变化）；5 个新文件全部命中 ALLOW 新文件条目。无未申报越界 |
| DENY 面零触碰 | `git status --porcelain -- packages/doc-runtime packages/vfsl CONTEXT.md docs/adr vitest.config.ts packages/replication-protocol packages/namespace-diagnostic-log apps domains` | **零输出**——W1 冻结面、vfsl 渲染器、词汇文档、ADR、测试入口、wire/诊断/应用面全部零 diff（SA6 §12.7-1 红线兑现） |
| readData 冻结面字节不变 | 实读 `read-schema-projection.ts` diff | `resolveSchemaBody` 共享前奏抽取为**结构等价**变换：无预算走两参渲染、预算走三参 + truncations、头行拼装同一 `headLine(normalized, options)`——两分支逐句对账输出逐字节不变；`normalizeReadPath` 仅加 `export` + JSDoc，函数体对 HEAD 零改动；readData 字节锚测试在 SA7 全量套件（391 文件）内绿 |
| W1 复制件逐函数对账 | 从 `doc-runtime/src/window.ts` L222/L379–510/L638–790 与 `carrier.ts` L26–90 提取原件，比对 `window-read.ts` L478–742 | `safeSpreadPath`→`safePathCopy`、`isNonNegInt`、`segMsg`、`yjsWord`、`isPlainRecord`、`readableOwnDataValue`、`readableArrayElement`、`navClassify`/`navigate`/`absentNav`/`notAllowedNav`、`classifyArrayTarget`/`classifyMapTarget`/`describeCarrierWord`、`carrierOf`、`probeRoot` 共 13 件**语义逐字一致**（仅 `readonly` 修饰与注释修剪）；每件头注带 `copied from window.ts@ab6e390` / `carrier.ts@ab6e390` / `read-schema-projection.ts@ab6e390` 出处标记（RA-3/N-1 兑现） |
| 计数语义 ≡ W1 候选空间 | 对账 `enumerateArrayCandidates`/`enumerateMapCandidates`（window.ts L503–540）vs `countWindowCandidatesAtPath`/`countMapEntries` | 数组面 = `length` 为界（Y.Array 与 plain array 同式，稀疏空洞计入）✓；键面 = Y.Map `keys()` 中 `get(k)!==undefined` ✓ / plain object `Object.keys` 过 `readableOwnDataValue`（descriptor 纪律、零 accessor 执行）✓——逐位一致；计数零值域读、不读排序键、不物化子项（决策 8） |
| canonical 判据 ≡ W1 校验 | 逐条比对 `validateWindowOptions`/`validateOrderBy`（window.ts L249–377）vs `canonicalWindowBudget`/`canonicalOrderBy`（window-read.ts L205–308） | 宿主 plain + 原型判别、封闭键空间（四键/`by`/`field`/`dir`）、descriptor 读零 `[[Get]]`、accessor 拒（get/set 双查）、ownKeys 谎报忽略、值 undefined ≡ 缺席、n ≥1 有限整数、预算轴 ≥0 + −0 归一、by/field 恰现其一、face 词表、整体 try 收编——**判据逐条一致**；稳定视图下 W1 已接受 ⟹ canonical 必接受（接缝只在漂移时触发） |
| F-369-1 修复结构性核验 | 实读 `composeWindowRead`（L149–184）+ raw path 全触点清单 | S5/S6 **单次** `normalizeReadPath(path)`（L170）；锚链（`anchorSchemaBody`）与 ✂ pathText（`windowPathText`）入参类型收窄 `readonly (string|number)[]`、只消费该快照——结构上不存在对实参 path 的第二次迭代/spread；快照缺席 ⟹ 正文 null ⟹ ✂ 块不装配（诚实 null）；失败面回显走 `safePathCopy`（Array.isArray + try 守卫）；S1 `readDisabled`→`echoReadPath` 同款守卫。与设计 §7.3 S5/S6 快照纪律逐字一致 |
| ✂ 窗口事实文法 vs 渲染器同款 | 比对 `renderTruncations`（render-projection-text.ts L994–1002）与 `foldText`（L983–985）vs `windowFactsBlock`/`appendWindowFacts`/`foldSegment` | 头行 `✂ 截断事实：`同字面；`- <path> · <kind> · …` 行文法对齐（kind 槽 = `窗口`）；空路径取渲染器约定字面 `[]`；折叠正则 `\r\n\|\n\|\r → ' ' + trim` 三分支同款；拼装「剥尾 `\n` + `\n\n` + 块 + 恰一 `\n`」≡ `blocks.join('\n\n')+'\n'` 同字节规则；块恒头行 + 恰一行事实行（四插值槽确定性渲染，field 名先折叠再入基槽——SA2 F-1 行注入防御兑现） |
| 恒四键与失败面 | 实读 S6 结算字面量 + W1 直通路径 | 成功 `{ ok:true, value:entries, schema, truncated }` 恰四 own 键（字面量构造）；`truncated = kept < total`；失败 = W1 `WindowReadFailure` 原样透传（`if (!windowResult.ok) return windowResult`——绝不吸收、无半窗）；lifecycle≠ready → `readDisabled`（零 options 读取、零 doc 触碰——gate 在 W1 调用之前）；lease released → 冻结 issue 先于一切透传 |
| 公共面记账 | 实读两包 `index.ts` diff + 守卫 diff + `runtime-acceptance-exports-audit.test.ts` 机制 | runtime index type-only +4 别名（值导出面仍恰 `RuntimeWriteFatalError`——audit 为运行时 `Object.keys` 探测，type-only 不可见，零 diff 自洽）；registry index type-only +4；键集守卫三处 runtime 12→14 + registry-open 13→15（既有键全保留，纯加法）；两接口 test-d 各 +窗口锁；`normalizeReadPath`/`projectSchemaTextBody`/`countWindowCandidatesAtPath`/`compose*` 均**不经** index 再导出（grep 实证零命中），包内模块通道消费先例（`projectReadDataSchema` 同款） |
| lease 别名与透传纪律 | 实读 `lease.ts`/`types.ts` diff | 两方法 released 短路先行 + active 期 raw 引用直传（F5 spy 锚定 argc===2 + 引用同一性）；Equal 锁 ×4（结果别名 ≡ runtime 结果 \| released issue；options 别名 ≡ runtime 签名第二参）——镜像 `_readAlias`/`_readBudgetAlias` 先例；`LeaseTypeAssertions` +4 项 |
| 测试卫生 | grep `.(skip\|only\|todo)(`、`console.`/`debugger`、`Date.now`/`Math.random`、`SA7-DATAFLOW`/`TODO`/`FIXME` 于全部新代码/测试 | **零命中**；fixture 用手动 clock + 确定性 randomBytes（既有先例形态） |
| diff 卫生 | `git diff --check` | 干净（零空白/冲突标记） |
| 测试入口真实 | 实读 `vitest.config.ts`（include `packages/*/test/**/*.test.ts`；typecheck include `*.test-d.ts`）+ CI 分片脚本形态 | 两 `.test.ts` 命中 runtime include、`.test-d.ts` 命中 typecheck include、fixture 非 `.test.ts` 不被收集（头注声明一致）；CI 按磁盘枚举分片（`.github/workflows/ci.yml` + `scripts/ci-test-shard.mjs`），新用例自动入片 |
| 文档准确性与词汇 | 逐句对账两文档新段 vs 实现/ADR/CONTEXT | 四键面、条目身份回溯、元素口径（含封闭对象容器口径 + depth 自容器起算披露 = R1/RA-2）、✂ 样张（`- workRecords · 窗口 · 基 index desc · kept 2/total 3` 与 fixture 数据 + B-8 字节文法一致）、三失败码 + PATH_NOT_ALLOWED 透传 + released issue、护栏 vs 选择器分工句——全部与实现/ADR 0028/CONTEXT「窗口读」「形状预算」词条一致；ADR 0028/0024/0027 链接在场且相对路径正确（`../../../docs/adr/…`）；无发明实现行为、无旧词汇（docs 同步门 SA3/SA7 两轮绿） |
| 依赖图 | 实读两包 `package.json` + import 面 | `window-read.ts` 消费 `@nomicore/vfsl`（既有 dependency）、`@nomicore/doc-runtime`（既有）、`yjs`（既有 ^13.6.30）——**零新增包图边** |
| 证据日志自洽 | 实读 `sa7-issue369-full-suite.log` 尾部 / `-typecheck-only.log` / `sa3-issue369-f369-1-{red,contract-green}.log` | 全量 391 文件/4722 用例 + `Type Errors no errors` + `PIPELINE_EXIT=0`；契约 2 文件/50 用例绿；F-369-1 修复前 T8 红（裸抛逃逸逐字复现）→ 修复后绿——红绿对真实；基线 388/4668 → +3 文件/+54 用例 = 交付三测试文件，计数自洽 |

## 3. 标准符合性逐项

### 3.1 ADR 0028（母法）—— ✅ 逐项符合

| 条款 | 符合性 | 证据 |
|---|---|---|
| 决策 1：lease 层两方法、`n` 必填 ≥1（`n:0` 非法） | ✅ | `NamespaceLease` +2 方法（types.ts）；第二参必填经类型面锁定（test-d 正/负例 ×5）；`n` 校验由 W1 单权威裁定（组合层不复制校验，S2 直通 + S3 判据镜像） |
| 决策 2：WindowTerm v1 词表（index/key/单段 field；语境外组合响亮拒绝） | ✅ | options 类型 = doc-runtime 单源 type-only 别名（Equal 锁 ×4 + test-d 单源锁 ×4）；词表外组合编译期 fail-closed（`@ts-expect-error`）+ 运行期 W1 码透传（F1） |
| 决策 3：统一条目列表、身份随行、呈现序 = 有序基之序、空容器 → `[]`、包装不进口径 | ✅ | W1 值直通（S2）；契约 A1–A4（own 键恰 `['index','value']`/`['key','value']`）、A3 空容器四类、A5 身份回环深读、A6 schema 无 `index:`/`key:` 包装键 |
| 决策 4：组合式 depth（入选项 ≡ 同预算 `readData(项路径)`；终点宽度由 n 治理） | ✅ | W1 冻结语义直通零改动；契约 E1（depth 0/1/2 逐项 `toStrictEqual`）/E2（maxChildrenPerNode 只治项内部） |
| 决策 6：schema = 元素口径投影文本；路径键控、与数据无关；空容器照常 | ✅ | B-6 锚链（数组单锚 `[...p,0]`；键面 `'<key>'` → 容器口径回退——封闭对象族呈现细节属 ADR 0028 开放问题 5 预留的实现票自由度，经 SA8 §3 裁 no-conflict 并文档披露）；契约 S1–S4 双侧剥离逐字节对账、S3 空满逐字节相等、无 active schema 照常四键 + null |
| 决策 7：恒四键；`truncated === kept < total`；窗口事实进 ✂ 段；total=0 无 ✂；三稳定码响亮不抛 | ✅ | §2 对账行；契约 T1–T9（Byte 级常量、预言机对账、total=0/kept===total 无 ✂、敌意 field/path 收编）；三码 + `PATH_NOT_ALLOWED` 原样透传（F1/F2/E4 与直调 W1 `toStrictEqual`） |
| 决策 8：O(N) 枚举 + 只物化入选项 + 未入选零物化 | ✅ | 计数 = 组合层 O(N) 标识枚举（零值域读）；E3 N=2000 毒值哨兵 `ok:true` kept 2/total 2000（全量物化实现必红）；物化仍由 W1 独占 |
| 决策 9：分层（doc-runtime 原语 / namespace-runtime 组合 / registry lease 面）；readData 与 ADR-0024 options 零改动 | ✅ | doc-runtime 零 diff（独立 `git status` 实证）；组合层新增 `window-read.ts` + runtime 闭包；lease 别名跟随；readData 字节不变（§2 对账 + NC1） |
| 敌意通道（options/orderBy 封闭校验、零外抛、零 accessor 执行） | ✅ | W1 校验直通 + S3 canonical descriptor 纪律 + F-369-1 快照纪律——敌意 options/field/path 三通道全部收敛为结果联合成员或诚实 null（契约 S3 三出口/T5/T6/T8/T9 + SA7 P6/P7） |

### 3.2 ADR 0027 / 0024 / 0016 / 0008 / 0009 —— ✅ 无违规

- **0027**：渲染器零选项纯函数原样消费（`projectSchemaTextBody` 第二参恒缺席——`validateTruncations` 闭于 depth\|width，窗口行**不经**渲染器，组合层追加系 SA8 §3.2 裁定的唯一合规路径，授权源 = ADR 0028 决策 7 后立条款；组合层作者身份有 readData 头行先例）；✂ 段仍为截断事实唯一载体（窗口事实无第二载体、无结构化键复活）；`schema:null` 单义直通（锚败/敌意 path/off-schema → null，非读失败）；已知限制 2 的窗口对偶（null × truncated 只剩布尔）如实登记（设计 §13 R4）并经 T7/T9 锚定。
- **0024**：预算两轴语义零重定义（canonical 判据含 −0 归一镜像）；readData options 闭合形状零触碰；`{}` ≡ 无预算渲染逐字节（SA7 P3 八锚点动态实证）。
- **0016/0008**：`resolveSchemaAtPath`/`renderProjectionText` 公共面原样消费；读全部同步、**不进 write sequencer**（包 AGENTS 边界）；`RUNTIME_READ_DISABLED` gate 镜像 readData B-1（lifecycle≠ready → 零 options 读取、零 doc 触碰）。
- **0009/registry AGENTS**：lease = 独立调用方能力面纯加法；released 短路先于一切透传、冻结 issue 单例；「aliases follow + Equal 锁」先例逐条镜像；公共 API 仅经 `src/index.ts`（四别名 type-only）；生产装配路径不变（`createNamespaceRuntimeForRegistry` 内部 seam 零触碰）。

### 3.3 模块 AGENTS 与根 AGENTS —— ✅ 无违规

- namespace-runtime：「Reads stay outside that sequencer」✓（全方法同步、零入队、零状态写入）；「Public APIs expose detached projections only」✓（条目 = W1 已物化的 detached 值、schema = string，无 live Y.Doc/handle 外泄）；「键集守卫逐键记账」✓（三处 runtime 守卫 + 一处 lease 守卫 + 两接口 test-d 同步纯加法）；「公共 API 仅经 index」✓（模块级导出 `normalizeReadPath`/`projectSchemaTextBody`/`compose*`/`countWindowCandidatesAtPath` 均包内消费、零 index 再导出——grep 实证；`normalizeReadPath` 导出已经 SA4 §6 偏差复核：必要/最小/合规，登记 O-7）。
- namespace-registry：「Add public APIs only through `src/index.ts`; keep hostile/test controls in the explicit testing surface」✓；ws-replication `decorateLease` 逐成员绑定同步（testing 面先例一致）。
- docs AGENTS：「Use repository vocabulary exactly」✓（复用 CONTEXT「窗口读」「截断事实段」「形状预算」既有词条——CONTEXT 零 diff 即零漂移）；「Link to the authoritative source」✓（两新段均链接 ADR 0028/0024/0027，消费指引形态非规范复制）；docs 同步门（`readdata-docs-adr0016-sync-control`）与形状收敛门两轮绿证据在案。
- 根 AGENTS typed-writes 强制：**不适用**（纯读能力，零 mutation 面）；replication/诊断日志/wire/schema  authoring 技能条款：零接触面，不适用。

### 3.4 架构一致性（责任归属 / 相似能力 / 单一事实源 / 生命周期对称 / 平行机制）

| 检查 | 结论 |
|---|---|
| 责任归属 | 载体机械留 doc-runtime（零 diff）；组合（锚链/计数/✂/四键）在 namespace-runtime `window-read.ts` + runtime 闭包；lease 面与别名在 registry——与 ADR 0028 决策 9 三层归属一致 |
| 相似能力对照 | canonical 接缝镜像 readData `canonicalReadOptions`（#336 双出口同构）；敌意 path 快照消费镜像 readData 头行「只读规范化快照」纪律（**收敛而非复制**——F-369-1 的根因正是偏离此先例）；lease 透传镜像 `leaseReadData`；投影正文经 `resolveSchemaBody` 单点共享前奏——全部对齐既有先例 |
| 单一事实源 | options/失败类型 = doc-runtime 单源（type-only 别名 + Equal 锁）；敌意 path 守卫 = `normalizeReadPath` 单源（导出复用，**未**复制第二份守卫）；schema 文本 = vfsl 渲染器单源；候选条目空间 = W1 枚举纪律为规范、组合层镜像计数（13 件出处标记 + 9 例独立预言机矩阵防线 + §13 R2 follow-up 登记）——本审查逐函数对账确认当前零漂移 |
| 生命周期对称 | 纯读：零新增 acquire/release、零订阅/缓存/后台/模块级可变态；runtime lifecycle 门与 lease released 门顺序正确且先行；close/release/reopen 语义零改动（SA7 P4/P5 状态机实证：停接纳、幂等、不复活、重开新 lease 正常）；失败可直接重试（读零副作用） |
| 平行机制 | 无第二排序器/第二导航器/第二 options 校验/第二截断事实载体/第二 path 守卫；计数镜像是 W1 面冻结 + #368 设计 L358–360 预知接受的**已裁折衷**（非私设平行机制），防线（出处标记 + 预言机对账 + T8 迭代协议读计数锚）在位 |

### 3.5 兼容性纪律 —— ✅

- 纯加法：runtime 12→14、lease 13→15，既有键与既有行为逐字节不变（2210 受影响包用例 + 391 文件全量零回归）；稳定码词表 append-only（组合层接缝/防御成员复用 W1 同型，零新码）。
- 无 wire/持久化/诊断记录/schema 形态/生成物变化；零迁移成本；发布 bump 评估（ADR-0027 §5 minor 先例）属发布流程，非本交付义务（设计 §13 已声明）。

### 3.6 证据工件 —— ✅

- 链：简报（0 评论）→ SA6 契约（approve 附冻结条件）→ SA1 设计（F-1 修订）→ SA8 冲突复查（clear，RA-1–RA-5）→ SA2 iteration 1（approve，F-1 销项）→ SA3 iteration 1（F-369-1 返工：修复前 T8 红逐字复现裸抛逃逸 → 修复后 50/50 契约 + 四包 2210 + 两道门全绿）→ SA4 iteration 1（approve，修复核验 + 偏差复核）→ SA7（approve，root 391/4722 + typecheck-only 231 + 探针 7/7，SA4 §11 三项动态项全兑现，临时探针已删净）。
- RA-1–RA-5 逐条兑现核对：RA-1 锚链原样（S4 oracle 锚 = 容器路径）✓；RA-2 文档披露（封闭对象容器口径 + depth 计量两文档均在）✓；RA-3 出处标记 + 预言机矩阵 ✓（§2 对账）；RA-4 冻结面零 diff ✓（DENY 独立复核）；RA-5 B-8 Byte 冻结常量（测试内单点 `FACTS_*` 常量）✓。

### 3.7 可维护性 —— ✅

- `window-read.ts` 头注完整（职责/编排 S3–S6/失败面/敌意通道/复制纪律）；所有复制件逐件 `copied from …@ab6e390` 标记 + 冻结解除对账义务句；公共类型逐件 JSDoc（runtime 接口两成员 JSDoc 达 readData 深度：四键/锚口径/✂ 事实/失败面/lifecycle 顺序/已知限制）。
- 测试三文件头注齐备（契约来源/红灯机理/断言纪律）；fixture 数据设计逐键注释；断言失败消息均带用例名语境。

## 4. 测试质量专项

| 维度 | 评估 |
|---|---|
| 行为断言纯度 | 全部断言运行时观察（结果联合/own 键集/条目列表/schema 文本/迭代协议读计数/异常捕获）；零源码文本断言、零 skip/only/todo、零 env override、零静默 fallback |
| 形状集中化纪律（NC6） | 成功形状一律经 `expectReadDataOkKeys`/`expectReadDataOk` 表达（含 T8/T9 敌意用例）；family A/B 收敛门两轮绿（59 tests）——新用例未把四键字面写死 |
| 防同义反复 | AC2 oracle = 同一次运行 `readData(锚,同预算)` 公共面产出（双侧剥离对账，非硬编码）；`total` 以独立预言机（Yjs/native 直数，零实现复用）对账 9 例边界矩阵 + T7；装置前提用例（fixture 身份/lease 身份）防夹具漂移假红；T5 对照调用（`field:'priority'` 不同窗口）证明呈现层折叠未污染值通道 |
| 判别力证据 | F-369-1 红绿对真实：修复前 T8 **红**（`Error: probe: hostile path segment（F-369-1 二次 spread 投毒）` 经 `captureArrayRead` 显式捕获——原始症状逐字复现，非合成断言），修复后 T8/T9 双绿 + 50/50 零回归；T8 参照系 `w1IterationReads` 以直调 W1 冻结面实测（行为锚定，非实现耦合），`iterations() === w1Reads + 1` 是回归哨兵（任何未来二次 spread 必触发投毒转红）；E3 哨兵使全量物化实现必红 |
| 入口真实性 | 能力存在性断言（`toBeTypeOf('function')`）在任何包装外，红灯首因统一为能力缺口（lease 13 键 / runtime 12 键无窗口面）——与 SA6 §12.8 规格一致 |
| 覆盖矩阵 | 主契约 33 用例（W2-A1–A6/S1–S4/T1–T9/E1–E4/F1–F6/NC1/NC4/装置前提）+ 组合层 17 用例（能力/S1/S3 三出口/S4 预言机/S5 锚链含无 schema 通道/E3/E4/负控）+ 类型层 Y1（单源 Equal ×4、恒四键 keyof ×4、别名 Equal ×2、签名/arity、负例 ×5）+ 键集/接口守卫——与 SA6 §12.2 用例组、设计 §12 验收映射、ADR 0028 缝 2 验收矩阵逐条对齐；S5（docs/别名在场）由 S2 `type Task = {` + 字段 docs 断言承接 |
| 类型面 | `.test-d.ts` 经 `--typecheck.only`（231 用例 no errors）与 root `pnpm test --typecheck` 双通道采集；两包接口 test-d 同步正/负例 |

## 5. 需求覆盖声明（标准轴视角）

本审查不裁 Issue AC 是否完整实现（属 SA10）；仅记录：AC1–AC6 每条在设计 §12 有映射、在契约/组合层/test-d 有行为锚、在 SA3/SA7 有红绿与全量绿证据；未发现验收断言被弱化（SA6 未落盘文件，契约转写经设计 §11 ALLOW 且全部语义断言——三码/四键/条目列表/✂ 事实/oracle/哨兵/透传——逐条保持并新增 T5/T6/T8/T9 强化）；未发现锚点与源码现状矛盾（W1 复制件对账、canonical 判据比对、守卫记账、文档样张均经本审查独立复核一致）。

## 6. 不需要冲突复查声明

标准轴 verdict 不改变公共 API/wire/schema/持久化/状态机/生命周期/失败语义面；SA8 设计后冲突复查（clear）在位且覆盖全部承重面（新公共 API、B-6 封闭对象回退、组合层 ✂ 窗口文本、分层与计数镜像），SA2/SA4/SA7 同裁 `requiresConflictRecheck: false`；本审查无新增冲突面（`requiresConflictRecheck: false`）。

## 7. Findings（MINOR，均不阻断）

| ID | 严重度 | 内容 | 证据 | 建议路由 |
|---|---|---|---|---|
| M1 | MINOR | 新增 JSDoc 三处「键面容窗口读」衍字（应为「键面窗口读」）：`runtime.ts` L265（接口 readMap）、L686（闭包注释）、`types.ts` L716（lease readMap）——系沿用 W1 `window.ts` L120 同款措辞（#368 SA9 M4 已立 MINOR 在先）；纯注释措辞，零行为影响 | grep `键面容` 实读 | 清理票统一改注释（建议与 #368 M4 同源收口） |
| M2 | MINOR | 8 个既有消费方替身/绑定文件（`ws-replication/src/testing.ts` + 7 个 registry 测试文件）不在设计 §11 ALLOW 枚举内——接口 +2 键编译强迫的机械同步（替身补成员恒 `PATH_NOT_ALLOWED` / `bind` 委托，零断言语义变化）；SA3 已如实申报、SA4 §6 已复核必要/最小/语义惰性并登记 O-4（根因 = 设计 ALLOW 枚举粒度未覆盖「接口 +N 键的替身同步面」规则条款） | `git diff` 逐块实读；SA3「ALLOW 之外的机械同步」表 | 后续设计票以规则条款预先覆盖该同步面（SA4 O-4 路由）；本 diff 无需动作 |
| M3 | MINOR | 跨包测试树依赖新形态：runtime 契约测试 import registry 测试树 fixture（`../../namespace-registry/test/issue-369-window-read-fixture.js`）；fixture 相对路径 import runtime src（`../../namespace-runtime/src/runtime.js` 测试 seam——其刻意不在 index/internal 面，跨包无公共路径可达）。既有先例仅覆盖反向（registry 测试 import runtime 测试 helper/fixture）；功能真实、typecheck/CI 入口真实，但属仓内首见的双向形态 | grep 实读（SA4 O-3 同项登记） | 卫生项：后续可经包 testing 面暴露 seam 构造入口或对偶复制（SA4 O-3 建议路由） |
| M4 | MINOR | 证据日志卫生：`sa3-issue369-f369-1-typecheck-tree.log` 为 0 字节、`-typecheck-packages.log` 仅命令横幅（`tsc --noEmit` 成功常态签名但无 exit code 标记）——本审查以 CI 等价 `--typecheck.only`（231 用例 no errors）+ 全量套件 `PIPELINE_EXIT=0` 交叉佐证采信 | 日志实读（SA4 O-9 同项登记） | SA3 后续日志附 `echo exit=$?` 尾行 |

## 8. Non-blocking observations

1. **SA4 O-1（键面容器回退锚未按 schema 形状收窄）**：设计 §7.2 规则 2 的事实前提与 resolver 实际行为有出入（容器锚在数组声明路径上可解析）——仅 raw 数据偏离 active schema 可达，后果为呈现口径选择（值通道正确、无崩溃）；实现与冻结设计逐字一致，属设计层澄清项（路由 SA1），非实现偏离。
2. **SA4 O-8（T8/T9 仅 readArray 面）**：readMap 与 readArray 共用 `composeWindowRead` 同一快照与装配骨架（面特异部分不触 raw path），静态覆盖成立；SA7 探针 P7 已动态复核 readMap 面变体（零外抛、事实行正确、迭代协议读恰 W1+1）——闭合。
3. **测试预言机微不对称**：两契约文件的 map 预言机过滤条件为 `desc.get === undefined`（未显式查 `desc.set`），实现的 `readableOwnDataValue` 双查 get/set——fixture 无 set-only accessor，无活分歧；若未来新增该类边界样本需同步预言机（登记备查）。
4. **未提交态**：本票交付 = 未提交 diff（22 tracked + 5 新文件 + artifacts/wiki 产物），与 dispatch 交付形态一致；commit/push/PR 与 wiki 产物入库属后续 finalize 流程，不在本审查范围（#368 M1 同类入库卫生事项届时一并处理）。
5. **发布 bump 评估**（ADR-0027 §5 minor 先例：新公共面为加法非破坏）属发布流程裁定，设计 §13 已声明非本票义务。

## 9. 结论

最终交付 diff 忠实落地已批准设计（SA1 F-1 修订版）与 ADR 0028 缝 2 全部条款：lease 公共面 `readArray`/`readMap` 恒四键结算、元素口径投影文本（B-6 锚链含封闭对象容器口径回退与披露）、✂ 窗口事实（B-8 四插值槽确定性渲染 + 单行不变式 + F-1 行注入防御）、组合式 depth 等价锚直通、O(N) 零物化计数、三失败码 lease 透传形状语义不变、作用域文档同步含分工句。冻结面全部零扰动：doc-runtime/vfsl/CONTEXT/ADR/vitest.config/readData 字节（独立 `git status` + 逐句对账实证）；F-369-1 修复（S5/S6 单快照纪律）结构性核验通过，敌意 options/field/path 三通道全部收编为结果联合或诚实 null。单一事实源保持（类型单源别名 + Equal 锁、`normalizeReadPath` 导出复用非复制、渲染器原样消费、计数镜像出处标记 + 预言机防线）；生命周期对称（纯读零 sequencer、门序正确）；文件范围除已申报并复核的 8 个编译强迫替身同步外精确命中 ALLOW；50 个新契约用例 + 类型面全部行为断言、入口真实、判别力有真实红绿对证据。证据链完整可溯。无 BLOCKER、无 MAJOR；4 项 MINOR 均为措辞/枚举粒度/卫生类，不阻断。按裁决规则：**approve**。
