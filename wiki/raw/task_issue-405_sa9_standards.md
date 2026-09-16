# SA9 Standards Review — Issue #405（readData 面：maxBytes 交付总量收/拒闸（tracer））

> SA9（独立 Standards 审查者），iteration 0（dispatch `sa-448e7a4c-9c50-432c-be7f-7b93e75d98ff`）。
> 被审对象：**最终已提交交付** commit `10b809f86b645ccdf16f67e4df6d7bf9228bc20d`
> 「feat(namespace-runtime): add readData maxBytes budget gate」（`git rev-parse HEAD` 实核 =
> 本 worktree HEAD；基座 = 母 PR #403 已解入的 `fc6c1d3`「docs(adr): 0031 readData
> 字节预算——交付总量收/拒闸（设计基座）」；tracked tree 干净，仅未跟踪证据 log）。
> Issue-comment REST 快照为空（无 owner 要求，与简报 Comments 段空、SA6/SA8 记录三方一致）。
> 审查面**仅限**仓库/工程标准：AGENTS、ADR 条款、模块责任、既有架构惯例、单一事实源、
> 生命周期对称性、文件范围与测试质量；Issue 需求完整性属 SA10 面，不在本报告裁决。
> 本迭代全部关键结论均经本人对最终 diff（`git show 10b809f` 全量 21 文件）、head 源码、
> 母法文本与落盘证据日志亲自核对（非仅转述上游 SA 产物）；按角色边界零运行
> （无 tsc/vitest/服务），运行级证据核对落盘日志。

## Inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-405.md`（任务简报：Issue 正文 + AC 十条；Comments 段空） | 已读全文 |
| `wiki/raw/task_issue-405_sa6_contract.md`（SA6 验收契约 rev2，494 行：§12.0 锚表 R0–R12 / §12.2 文件清单 / §12.3 G1–G12 / §12.5 反伪绿 R1–R11 / §12.7 pins / §12.8 门禁） | 已读全文 |
| `wiki/raw/task_issue-405_design.md`（SA1 设计，399 行：DD-1–DD-9 / §8.1 组合次序 / §11 ALLOW-DENY / §12 验收映射 / §15 recheck=true） | 已读全文 |
| `wiki/raw/task_issue-405_design_conflict_report.md`（SA8 设计门禁 iteration 2，**clear**：16 项对照；RA-D1–RA-D5） | 已读全文 |
| `wiki/raw/task_issue-405_sa2_review.md`（SA2 **approve**；Required revisions 空表；MINOR-1–4） | 已读全文 |
| `wiki/raw/task_issue-405_sa3_impl.md`（SA3 实现报告 iteration 2：13 ALLOW 路径；红灯基线复现；变异探针 M1–M3；Deviations 1–6） | 已读全文 |
| `wiki/raw/task_issue-405_sa4_review.md`（SA4 **approve**；Required revisions 空表；MINOR-1–6） | 已读全文 |
| `wiki/raw/task_issue-405_implementation_conflict_report.md`（SA8 实现后复审，**clear**：18 项对照；§5 冻结面 12/12 保持；RA-D1–D4 闭合；RA-I1–I4 登记） | 已读全文 |
| `wiki/raw/task_issue-405_relevant_decisions.md`（决策集摘录） | 已读 |
| 最终 diff 亲核 | `git show 10b809f` 全量：13 实现/文档路径逐 hunk（runtime.ts +307/−39、index.ts +9 纯注释、5 新契约/夹具、2 原位修订、Phase B 三文档）+ 8 wiki 过程产物；DENY 面（`packages/doc-runtime`、`packages/vfsl*`、`read-schema-projection.ts`、`window-read.ts`、`packages/namespace-registry/src`、`CONTEXT.md`、`docs/adr`、`vitest.config.ts`、`tsconfig*.json`、`apps/**`、根 `package.json`）diff --stat 实测 **0 行** |
| 母法亲读 | `docs/adr/0031-readdata-byte-budget.md`（决策 1–6 + 修订节 + 备选 + 验收节，81 行全读）；`CONTEXT.md` L48–58「字节预算/形状预算」词条（head 实读在案）；根 `AGENTS.md`；`packages/namespace-runtime/AGENTS.md`（reads 不进 sequencer、公共面只暴露 detached 投影、root typecheck+test 义务）；`packages/namespace-registry/AGENTS.md`（公共 API 只经 `src/index.ts`）；`docs/AGENTS.md`（代码行为变化须同步每份陈述该契约的规范文档；不复制规则、链接权威源） |
| head 源码亲核 | `runtime.ts`（三键 interface L149–171、`ReadDataBudgetExceededResult` L198–212、预算联合 L214–221、readData 组合体 L743–846 逐行、split/canonical/deliveryBytes/readDataBudgetExceeded/budgetAxisInvalid L1105–1327）；`index.ts`（导出块 L71–79：`ReadDataBudgetExceededResult` **未**经本入口导出——grep exit 1 实证，导出键集零扰动）；`package.json`（exports 仅 `.` + `./internal`；版本 0.1.12 未动） |
| 独立 grep | apps 生产调用点唯一 `app.ts:612` 单参 legacy 通道；DENY 面 `maxBytes` 零命中；新契约文件 `skip/only/todo` 零命中（0）；`git show --check 10b809f` 零空白警告 |
| 落盘证据核对 | `artifacts/sa3-issue405-verification.log`（红灯基线 14 failed/14 passed 红因单一；契约族 9 files/70 tests 绿；包内 tsc×2 + vitest 130 files/1258 tests；root `pnpm typecheck` exit 0；root `pnpm test` 417 files/5055 tests exit 0 = 基线 412/5021 +5 files/+34 tests；doc-sync 43/43；DENY diff 空；变异探针 M1 6 failed/M2 7 failed/M3 1 failed 各自被捕获）；`artifacts/sa6-issue405-baseline-*.log`（基线 412/5021 对照） |

## Verdict

**approve** —— 最终已提交 diff 全面符合仓库与工程标准；无 BLOCKER / 无 MAJOR。
ADR 0031 决策 1–6 与其验收节在交付中以最小公共面增量忠实兑现：校验与度量唯一落点
（namespace-runtime 组合层）、T1 单源权威经忠实中继保持、registry 源码零改动别名跟随、
冻结面 12/12 保持、ALLOW/DENY 范围干净、契约测试为真实行为测试且经真实 runner 发现。
SA2/SA4/SA8 三轮上游审查已裁 approve/clear，本审查对最终 diff 独立复核未发现新增标准违例。
9 条 MINOR 观测见 §8（全部已在上游产物中披露并裁决），均不阻断。

---

## 1. 仓库 AGENTS 与模块契约

| 标准 | 证据（最终 diff / head 亲核） | 判定 |
|---|---|---|
| 根 AGENTS「改 packages//docs/ 前读最近嵌套 AGENTS 并守其边界」 | 全链（SA6/SA1/SA8/SA2/SA3/SA4）均已读并对账；本审查对 runtime/registry/docs 三方 AGENTS 逐条独立复核（下行起） | ✅ |
| runtime AGENTS「Reads stay outside that sequencer」 | readData 组合体（L743–846）仍为同步纯函数：零 sequencer、零缓存、零订阅、零状态写入；新增 split/canonical/闸门均为包内纯函数 helper | ✅ |
| runtime AGENTS「Public APIs expose detached projections only」 | 五键失败分支为新鲜对象 + `echoReadPath` 新鲜回显（非别名实参——G3 变异隔离断言锚定）；relay/canonical 为组合层私有新对象，不逃逸；live Y.Doc/handle 零暴露 | ✅ |
| runtime AGENTS Verification「runtime 契约变更前跑 root `pnpm typecheck` + `pnpm test`」 | 落盘日志：root typecheck（14 project）exit 0；root test 417 files/5055 tests exit 0、Type Errors no errors（= 基线 +5 files/+34 tests，恰为 5 新契约/夹具文件与 14+8+3+6+3 用例） | ✅ |
| registry AGENTS「Add public APIs only through `src/index.ts`」「lease 独立调用方能力」 | registry `src/**` **零 diff**（diff --stat 实测）；lease 行为面零新增逻辑（raw 引用直传——G9 同一引用断言）；三键 options 与新失败分支经 `types.ts` 按名单源别名自动跟随 | ✅ |
| docs/AGENTS「代码行为变化须同步每份陈述该契约的规范文档」 | Phase B 三文件（`typed-access.md` / `cordis-plugin-hosting.md` / `external-project-vfsl-codegen.md`）重录**与实现同变更集**落地（OBL-DOC-1「同变更集」形态，SA6 §3.3/SA8 RA-D3 允许的合法形态）；失真句「only the two budget keys」已清退；CONTEXT.md/ADR 在基座 `fc6c1d3` 已自洽，本票零触碰（DENY 实测 0 行） | ✅ |
| docs/AGENTS「Use repository vocabulary exactly」「链接权威源而非复制规则」 | 重录文本逐点使用 CONTEXT.md「字节预算」词条与 ADR 0031 词汇（交付总量收/拒闸、`READ_BUDGET_EXCEEDED`、`measuredBytes` 合计、✂ 段自然计入、缺席目标可超限、决策 6 分工）；三处均以链接指认 ADR 0031；文档陈述与实现语义逐点一致（域/等式/≤/五键/塑形后计量——与代码逐项核对） | ✅ |
| 根 AGENTS typed-writes 强制面（generate/typecheck/typed adapter） | 不适用：本票零 VFSL schema 改动、零 Namespace 数据写路径（纯读面 Feature） | ✅（无义务触发） |

## 2. ADR 条款符合性（架构契约）

| ADR 条款 | 实现落点（head 亲核） | 判定 |
|---|---|---|
| 0031 决策 1（三键 + 域句 + 复用校验码 + 缺席 ≡ 无预算 + 无魔法默认） | `NamespaceRuntimeReadDataOptions` 自持三键闭合 interface（L149–171，JSDoc 载明 0024→0031 修订链）；split（L1237+）与 canonical（L1127+）双处同判据 `typeof v === 'number' && Number.isSafeInteger(v) && v >= 1`；域外（0/负/1.5/NaN/Infinity/string/2^53/2^53+2）→ `READ_OPTIONS_INVALID`；缺席/present-undefined/非 enumerable ≡ 无预算（G10 断言锚）；未新增校验码 | ✅ |
| 0031 决策 2（规范度量 + 账本不进公共面） | `deliveryBytes`（L1298+）= `(value===undefined?0:utf8(JSON.stringify(value))) + (schemaText===null?0:utf8(schemaText))`——构造性等式零镜像代码；闸门在投影组装**之后**（度量对象 = 塑形后交付物）；成功面恒四键不加 bytes 键（组装体 L840–845 + `_budgetOkKeys` 类型锁） | ✅ |
| 0031 决策 3（超限零交付五键 + 合计 + ≤ + 不裁剪） | `readDataBudgetExceeded`（L1311+）恰五键、`echoReadPath` 新鲜回显、message 不含面标识；`measuredBytes > maxBytes` 才拒（≤ 含恰好等于与零总量）；成功路径不触碰已组装四键（逐字节相同由构造保证） | ✅ |
| 0031 决策 4（分层落点 + 零变化清单） | 全部生产改动集中 `runtime.ts` + `index.ts` 注释；doc-runtime/vfsl/渲染器/窗口面/registry src diff 实测 0 行；canonical 产物 `options` 恒两键（`maxBytes` 下传前剥离——头行结构上看不到它，G8 `includes('maxBytes')===false` 断言）；`DeepOptional`/vfsl-protocol 零 diff | ✅ |
| 0031 决策 5（边界：缺席目标照常计量；终态非 no-op；where 无对撞） | 闸在投影之后、`value===undefined` 计 0/`schema:null` 计 0 由构造保证（G6 `['nick']` 26 拒/27 收锚；G3 R9 单通道锚）；窗口面零触碰（G11 递延期守卫） | ✅ |
| 0031 决策 6 + 验收节（文档负控 + 门禁 + minor bump） | 使用指引（分工 + 确定性重试）进 typed-access 新小节与两份 integration 文档；全套门禁落盘证据绿；**minor bump 未随 diff 落地**（0.1.12 未动）——SA8 RA-I2 已登记为发布门（阻塞发布、不阻塞代码交付评审），且仓内惯例为发布期统一 bump（feature commit 如 `c09a055` 均不动 package.json；本包 package.json 历史仅发布准备提交触碰） | ✅（bump 为已登记发布期动作，见 §8-M5） |
| 0027/0024（0031 修订链后：恒四键、✂ 唯一载体、渲染器零选项、头行文法、E1 纪律） | 成功面/✂/头行/渲染器/值面全部零 diff；G7 锚表逐锚复验 + G8 双侧逐字节锚；`keyof ReadLogicalValueAtPathOptions` 恰两键硬锁（test-d） | ✅ |
| 0008 + 0009 族（同步结果联合、lifecycle 停接纳稳定码先行） | S1 lifecycle gate 在 options 首次触达之前（代码序静态核实 L769–790）；失败全数同步结果联合；唯一 throw 逃逸通道仍是可信域 `InternalError`（投影面，不变）——S2b-0 的 fail-loud 不变式守卫 throw 结构不可达（doc-runtime G0 恒拒），SA8 §3 行 16 已裁 no-conflict | ✅ |
| 0023 + issue #93 公共导出纪律 | `index.ts` 仅注释增量（+9 行 `#405 增量` 说明）；`ReadDataBudgetExceededResult` **不**经公共入口导出（grep exit 1 实证），消费方经 `Extract<…, {code}>` 结构可达；值导出面仍恰 `RuntimeWriteFatalError`；导出审计测试零触碰 | ✅ |
| 0028/0029（窗口面词表 + where ✂ 永不装配） | `window-read.ts` 零 diff（键空间仍五键）→ 携 `maxBytes` 维持 `WINDOW_OPTIONS_INVALID`（G11 锚）；OBL-WIN-1 窗口面三面义务挂账独立票（SA8 RA-I1 可追溯），message 文案已冻结为镜像基准 | ✅ |

## 3. 模块责任归属

| Behavior | Expected owner（母法/惯例） | 交付落点 | 判定 |
|---|---|---|---|
| `maxBytes` 校验与度量 | 唯一同时见值/schema 两通道的组合层（ADR 0031 决策 4） | `runtime.ts` readData 组合体 + 包内 helper | ✅ 无应用层复制 |
| 两轴域/未知键/宿主校验 | doc-runtime T1 单一权威 | split 忠实中继（`defineProperty` 原样复制未知键/accessor/非法值）→ T1(relay)；message 单源不漂移（`{maxBytes:1,nope:1}` 仍以「未知键：nope」被拒——G5 第四键断言） | ✅ |
| 接缝净化（canonical） | runtime 接缝（#336 先例） | 三键白名单 + `maxBytes` 剥离/回传；视图不稳定走出口①（re-split + re-T1）/出口②（seam 不变） | ✅ |
| 预算值权威 | canonical 后读（组合层单源） | 闸门消费 `canonical.maxBytes`，与投影通道消费 `canonical.options` 同源 | ✅ |
| lease 透传 | registry 零解释直传 | registry 源码零 diff；按名别名自动跟随 + Equal 锁原位扩展 | ✅ |

## 4. 既有架构惯例

| 惯例 | 先例 | 交付 | 判定 |
|---|---|---|---|
| 组合层同纪律重读 helper（判据镜像、非第二权威） | `canonicalWindowBudget`（window-read.ts） | `splitReadDataOptions` 逐字镜像 T1 读纪律（宿主门 → `Object.keys` → 逐键显式 gOPD、零 `[[Get]]`、try 收编）——本审查逐行对照 doc-runtime `read.ts` L326–361 | ✅ |
| runtime 构造 options 失败成员的 D1 豁免登记 | `seamReadOptionsInvalid`（形状由 `ReadLogicalValueBudgetFailure` 单源类型注解锁死） | `budgetAxisInvalid` 同款豁免（maxBytes 域在 T1 两键视野内结构性不可观测）；返回类型注解锁死 | ✅ |
| runtime 自持失败成员（不新增公共导出名） | `RuntimeReadDisabledResult` | `ReadDataBudgetExceededResult`（经 `Extract` 结构可达；index.ts 零导出扰动） | ✅ |
| 契约文件命名/组织 | `issue-<N>-*-red.test.ts` / `*.test-d.ts` / 非收集 fixture 谱系 | 5 个新文件同名规范；fixture 非 `*.test.ts` 不被收集 | ✅ |
| 既有测试锚零编辑（敌意面读次序 parity） | F-x5=4/F-x6=5 descriptor 计数锚（DENY 保护） | split 替位 T1 成 raw 第一读者后计数逐点保持（SA2/SA4 独立重算 + 契约内三键面 4/5 断言 + 日志复跑绿）；既有 27+5+2 readData 面套件零编辑 | ✅ |
| wiki/raw 过程产物随交付提交 | #393（`9ac5059`）等先例 | 8 个 `task_issue-405*.md` 随 commit | ✅ |
| 版本 bump 承载公共面变化 | 发布期统一 bump（feature commit 不动 package.json） | 0.1.12 未动；SA8 RA-I2 登记发布门 | ✅（见 §8-M5） |

## 5. 单一事实源

| Fact | Authoritative source | Derived state | Drift risk | 判定 |
|---|---|---|---|---|
| `maxBytes` 预算值（闸门） | canonical 复读后读值 | split 前置域判定只服务定序、不供闸门消费；与投影通道同一次 canonical 后读对齐 | 低（双处同判据为 T1+canonical 既有「判据判定」模式延伸，非第二权威） | ✅ |
| T1 失败 message | doc-runtime 单源 | relay/raw 直传保证透传；runtime 仅新增 maxBytes 域三常量（T1 视野外、契约不钉死措辞） | 低 | ✅ |
| 字节度量 | `deliveryBytes` 构造式（整体序列化即度量） | 无镜像代码；测试 oracle `measureChannels` 从同参无预算读**独立**两通道测量（反伪绿 R1） | 低 | ✅ |
| options/结果类型形状 | runtime 自持 interface + 包内失败成员接口 | registry 按名别名 + 双侧 Equal 锁（`_optionsClosedShape`/`_budgetExceededAliasFollow`/`_exceededShape`/`keyof` 硬锁）——只改 runtime 不改别名即编译红 | 低（锁的结构作用） | ✅ |
| 字节锚 R0–R12 | SA6 §12.0 冻结常量 | fixture 常量与锚同变更集；`anchorById` 缺席 loud throw | 低（文本改动即预期红，非伪绿） | ✅ |

## 6. 生命周期对称性

| Start/acquire | Stop/release | 判定 |
|---|---|---|
| 无新资源（同步纯读；relay/canonical/失败分支均为组合层新鲜对象，不逃逸不缓存） | 无需释放 | ✅ 无新增生命周期面 |
| S1 lifecycle gate（closing/closed → `RUNTIME_READ_DISABLED`） | 先于一切 options 触达（代码序静态核实 + G10 get-trap 0 次锚）；`echoReadPath` 隔离实参事后变异 | ✅ |
| lease released 短路（`NAMESPACE_LEASE_RELEASED` 三键） | 先于一切透传、零 runtime 触达（G9 断言 recording runtime 调用 0 次） | ✅ |
| 测试装置（runtime close / lease release / registry shutdown） | 各用例成对（亲核 red/control/registry 三族） | ✅ |

## 7. 文件范围与测试质量

### 7.1 文件范围（对设计 §11 ALLOW/DENY + SA8 §5 冻结面）

- ALLOW 13 路径**逐一对应**（runtime.ts / index.ts 仅注释 / 5 新契约·夹具 / 2 原位修订 /
  Phase B 三文档），无越权、无缺失；8 wiki 过程产物 = 仓内交付惯例（§4）。
- DENY 全集（doc-runtime、vfsl*、`read-schema-projection.ts`、`window-read.ts`、registry
  `src/**`、CONTEXT.md、docs/adr、vitest.config.ts、tsconfig*.json、apps、根 package.json）
  diff 实测 **0 行**；DENY 面 `maxBytes` 词 grep 零命中（本审查独立复核）。
- B11 两键 `Equal` 锁原位三键化 + **相邻注释同步重写**（RA-D2 条件）与类型变更同变更集
  （同一 diff，无中间红态）；registry 别名锁原位扩展（SA6 §12.2 已列名）。
- SA8 实现后复审（RA-D4）已对 §5 冻结面 12/12 逐项核对保持并裁 `clear`、
  `requiresConflictRecheck=false`；本审查对最终 diff 独立复核**未发现新增 ADR 冲突风险**，
  故不重复触发 conflict recheck。

### 7.2 测试质量

| 维度 | 证据 | 判定 |
|---|---|---|
| 红灯先行（red-first） | 红灯基线复现（生产 revert 到 HEAD）：`Test Files 2 failed \| 1 passed`、`Tests 14 failed \| 14 passed`，红因单一（12 条均 `READ_OPTIONS_INVALID`「未知键：maxBytes」）；控制组 HEAD 即绿 8/8（§12.4 判定表自洽）；复现后源码 md5 逐一比对恢复 | ✅ |
| 绿灯归因 | 契约族 9 files/70 tests 绿（含 F-x5=4/F-x6=5 与三键面 4/5 parity）；红→绿由同一变更集承载 | ✅ |
| 行为断言非源码文本 | 断言只观察公共接缝（结果联合、own 键集排序比较、字节数、渲染文本、trap 计数）；无源码字符串断言（SA3/SA4 同判，本审查 grep 复核零 skip/only/todo） | ✅ |
| 反伪绿 R1–R11 | 期望 = 冻结锚或同参无预算读独立 oracle（R1）；G5 组级判据（拒绝锚 ∧ 有效域接受锚同组，C-LIMIT `2^53`/`2^53+2` 拒 ∧ `2^53−1`/`1` 收——R2）；成功恰四键（`expectReadDataOkKeys` 集中 helper）/失败恰五键显式键集（R3）；CJK 锚单位敏感（R4）；单通道锚 R7/R9（R5）；塑形后计量 `{depth:1,maxBytes:414}` 必拒（R6）；非 enumerable/accessor/present-undefined 键空间纪律（R7）；优先级阶梯 lifecycle>校验>路径>预算（R8）；装置前提 fail-loud（R9）；边界成对 total 收/total−1 拒（R11） | ✅ |
| 变异敏感性 | M1（`>`→`>=`）6 failed、M2（丢 schema 通道）7 failed、M3（split 域判定失效）1 failed——三语义面各自被独立断言捕获（源码 md5 前后一致留档） | ✅ |
| 负控/正控 | G11 窗口面/doc-runtime 面携 `maxBytes` 各走其码；无预算窗口行为指纹不变；doc-runtime 两键面健康锚 | ✅ |
| 夹具纪律 | 冻结 schema 文本（CJK 种子）、MemoryPersistence + seam + `expect.poll` ready（既有 fixture 纪律）、manual clock + deterministic randomBytes + test scheduler（registry 先例） | ✅ |
| 测试入口真实 | `vitest.config.ts` L15/L20 include 覆盖全部新文件；`.test-d.ts` 经 typecheck 引擎（`tsconfig.typecheck.json`）；零配置改动 | ✅ |
| 门禁结果（落盘证据） | 包内 tsc×2 exit 0；`vitest run --typecheck` 双包 130 files/1258 tests；doc-sync 门禁 43/43；root typecheck exit 0；root test 417 files/5055 tests exit 0（零 skip/only/todo）；`git diff --check` exit 0；本审查 `git show --check 10b809f` 零空白警告复核 | ✅ |
| 文档同步真实性 | Phase B 重录后全部 `readData(...)` 调用字面保持两键形态（grep 亲核三文件），doc-sync scanner（两键白名单）0 违规——scanner 三键化滞后已登记（§8-M4），maxBytes 词汇在场性本次经人工内容核验 | ✅ |

## 8. MINOR 观测（均不阻断 approve；全部已在上游产物中披露并裁决）

- **M1（G10 lifecycle 组一处断言空转，测试精度）**：`descriptorCounting` 代理构造后从未传入
  任何 `readData` 调用，其 `descriptorCalls()===0` 断言恒真（SA4 MINOR-1）。主性质
  （lifecycle 先于 options 触达）仍由码断言 + fail-loud 前提 + get-trap 0 次 + 代码序静态
  可证钉住。建议后续触碰该文件时接入一次 closing/closed 期调用或删除该死代理。
- **M2（SA6 §12.3 G5 第四键行 message 字面与 DD-2 的张力，契约文本精度）**：实现按 T1
  单源拒绝（message 命名 `nope`、与 `{nope:1}` 同文），契约单行字面若逐字施加将迫使复制
  T1 message 或回退 HEAD 未知键路径（均被 DD-2 否决）；SA4 已裁实现侧正确、组级红/绿
  判据不受影响（SA3 Deviation 3、SA8 §3 行 17 同裁）。建议契约下次被触碰时改写该行。
- **M3（类型/惯例精度两则）**：① `splitReadDataOptions` 的 relay 返回注解为三键 runtime
  interface 而非最小诚实面（SA4 MINOR-3，行为等价）；② `Buffer.byteLength` 为 runtime
  src 首个 Node 全局（SA2 MINOR-2）——部署面 Node-only、`@types/node` devDep 在位、
  不追加等长分配的理由已写入 `deliveryBytes` JSDoc，记录不处理成立。
- **M4（doc-sync scanner 两键白名单滞后，门禁滞后）**：`BUDGET_OPTION_KEYS` 未纳三键
  （SA3 Deferred #4 / SA4 MINOR-4 / SA8 RA-I3 已登记后续票）；`maxBytes` 语义在场性暂不
  由该门禁机器强制，本次以人工内容核验兜底（三文件 0 违规实测）。
- **M5（版本未 bump，发布门已登记）**：`@nomicore/namespace-runtime` 仍 0.1.12；ADR 0031
  验收节「发布随 minor bump（0.x 破坏性 minor）」由 SA8 RA-I2 登记为发布期动作（阻塞
  发布、不阻塞代码交付评审），与仓内「feature commit 不动 package.json、发布期统一 bump」
  惯例一致。已备案的显式决策，非遗漏。
- **M6（证据 log 未随 commit 入库）**：`artifacts/sa{3,6}-issue405-*.log`（11 份）仍为未
  跟踪文件。仓内两种先例并存（随交付入库 / 独立 evidence commit 后补），`.gitignore` 不
  排斥；与 #393 SA9 M1 同款。建议按惯例以独立 evidence commit 落盘，使报告引用在克隆后可核。
- **M7（commit message 从简）**：交付 commit 仅单行 subject，未带 `#405` 引用与 SA3 建议
  的详细正文；仓内 fix/feat commit 惯例多带 issue 引用与正文。不影响代码面标准。
- **M8（设计产物括注矛盾残留）**：SA2 MINOR-1（DD-5.1 括注与 DD-3 矛盾）经实现按 DD-3
  消解（canonical 放宽三键），但设计文件本体未修订（SA3 职责边界不改设计）。记录在案。
- **M9（观测面无影响两则）**：① 非 plain 宿主 options 现被 `getPrototypeOf` 探测两次
  （split 宿主门 + T1 宿主门）vs HEAD 一次——无测试计数该通道、分类与 message 不变
  （SA4 MINOR-5）；② 变异探针 M3 显示「非法 maxBytes 在 doc 触碰前短路」的定序事实仅
  由 message 域断言承载可观测性（码由 canonical 接缝兜底，SA3 Deviation 4 / SA4 MINOR-6
  如实登记；契约 D5 明示不钉死措辞、组级判据不受影响）。

## 附：本轮独立复核清单（证据基础）

- **git 实测**：`git rev-parse HEAD` = `10b809f…`（= 交付 commit）；`git show 10b809f --stat`
  全量 22 路径（13 实现 + 8 wiki + 本 commit 含 SA6 契约）；DENY 路径 `--stat` 空输出；
  `git status` tracked 干净（仅 11 份未跟踪证据 log）；`git show --check` 零空白警告。
- **diff 逐 hunk**：runtime.ts（三键 interface / 五键失败成员 / 联合追加 / 组合体
  S2b-0→S2b-5 / split / canonical 三键 / 四 helper / JSDoc 阶梯）；index.ts（+9 纯注释，
  导出语句区零改动——`ReadDataBudgetExceededResult` 未经公共入口导出，grep exit 1）；
  两原位修订（B11 三键锁 + 相邻注释重写；registry 别名锁延伸 + 调用点 + 第四键
  `@ts-expect-error`）；Phase B 三文档（清退句消失、新小节词汇逐点 = 实现语义、决策 6
  分工句在场、ADR 0031 链接在场）。
- **head 源码**：readData 组合体 L743–846 逐行（S1 → S2a → S2b-0 G0 → split → T1(relay) →
  canonical → 出口①/② → 投影 → 闸门 → 恒四键）；split 与 doc-runtime `read.ts`
  L326–361 读纪律逐行对照同构；`package.json` exports 仅 `.` + `./internal`。
- **grep**：DENY 面 `maxBytes` 零命中；apps 生产调用点唯一（`app.ts:612` 单参）；
  新契约文件 skip/only/todo 零命中；SCOPE_DOCS 三文件 `readData(...)` 调用字面全两键。
- **证据 log 尾部**：sa3 verification（红灯 14/14 红因单一；契约族 9/70 绿；包内
  130/1258；root 417/5055 exit 0；doc-sync 43/43；DENY 空；M1/M2/M3 捕获）；
  sa6 baseline（412/5021 对照）。
