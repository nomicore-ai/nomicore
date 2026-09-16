# SA10 Spec 审查 — Issue #405 `readData 面：maxBytes 交付总量收/拒闸（tracer）`

- 派发：`sa-56221b63-7deb-4145-9906-1913009979ee`（role `mabf-sa10`，phase `spec-review`，iteration 0）
- 审查对象：**已提交最终交付** commit `10b809f86b645ccdf16f67e4df6d7bf9228bc20d`（`feat(namespace-runtime): add readData maxBytes budget gate`），基于母 PR #403 解决点 `fc6c1d3a4d56453a6c7288519ec7cbfe852f8e1a`（ADR 0031 入仓）。工作树 `packages/**` / `docs/**` / `.agents/**` 与该 commit 零 diff（实测 `git status`/`git diff 10b809f` 为空）。
- 审查方式：静态规格核对——实读 Issue 正文与 AC 十条、ADR 0031 全文、CONTEXT.md「字节预算/形状预算」词条、SA6 契约 rev2（验收权威）、SA1 设计、SA2/SA4 评审、SA3 实现报告与验证日志、SA8 实现后冲突复审（`clear`），并对最终 diff 全量（runtime.ts +307/−39、index.ts 纯注释、5 新测试/夹具、2 原位类型锁、3 篇 Phase B 文档）逐面核对。按角色约束**未运行测试/服务**；门禁绿证据采纳 SA3 实跑日志 `artifacts/sa3-issue405-verification.log`（SA4 经 md5 与工作树交叉核实一致）。
- Owner 评论：无（简报 Comments 段空、派发说明 REST 快照为空、SA6/SA8 多方一致）——无评论来源义务或 override。

## Verdict

**`approve`** —— Issue #405 正文「What to build」全部要件与 AC①–AC⑩ **逐条达成**；ADR 0031 决策 1–6、修订节与验收节在 readData 面（本票范围面）全部兑现；无遗漏、无部分实现、无错误实现、无 scope creep。须随 PR 披露的未达成/挂账项全部为**已登记的非阻塞递延**（见 §5），不构成本票 AC 的 partial/unmet。

## 1. Issue AC 逐条核对

| AC | 要求 | 交付证据（commit `10b809f`） | 判定 |
|---|---|---|---|
| ① | 总量 ≤ 预算成功，交付物与同参无 `maxBytes` 读逐字节一致 | 闸门在投影组装之后、恒四键组装之前，`≤` 时原样返回已组装四键（runtime.ts L829–846，成功路径零触碰交付物——逐字节相同由构造保证）；G1 双例 `toStrictEqual` 四键全等 + schema 逐字节（含复合三键 `{depth:1,maxBytes:415}`） | **达成** |
| ② | 恰好等于 `maxBytes` 成功（≤ 判定） | 判定式 `measuredBytes > canonical.maxBytes` 才拒（等号收）；G2 五锚（R0/R6/R7/R8/R11）`total` 收 / `total−1` 拒**成对**，含 R8 零总量 `maxBytes:1` 收 | **达成** |
| ③ | 超限零交付：五键失败分支，`measuredBytes` 两通道合计 | `readDataBudgetExceeded` 恰五键 `{ok:false, code:'READ_BUDGET_EXCEEDED', path, measuredBytes, message}`（runtime.ts L1311–1327，类型注解锁死、零成功键）；G3：own 键集恰五键、`measuredBytes===358` 且 `≠120`（值侧）`≠238`（schema 侧）、path 新鲜回显 + 实参变异隔离、R7/R9 单通道锚 | **达成** |
| ④ | 度量等式 property（`schema:null` 计 0、`value===undefined` 计 0、可因投影文本超限报错） | `deliveryBytes` = `(value===undefined?0:utf8(JSON.stringify(value))) + (schemaText===null?0:utf8(schemaText))`（L1298–1303，构造性等式、零镜像代码）；G4：R0–R7/R11 + R9/R10 共 11 锚成对 + **独立两通道 oracle**（`measureChannels` 从同参无预算读独立测量，绝不消费被测 `measuredBytes`） | **达成** |
| ⑤ | options 负控：`0`/负数/非整数/非有限数/未知键 → `READ_OPTIONS_INVALID`（message 区分 maxBytes 域） | split 域判定 `typeof number && Number.isSafeInteger(v) && v >= 1`（ADR 0031 域 = 1..2^53−1），域违约 message 含 `maxBytes` 且与未知键 message 不同；未知键经忠实中继仍由 doc-runtime T1 单源拒绝；G5 组级判据：域外矩阵（0/-1/1.5/NaN/Infinity/string/2^53/2^53+2）全拒 ∧ 有效域接受锚（2^53−1 成功逐字节相同、{maxBytes:1} 报预算码而非校验码）同组——反伪绿配平在案 | **达成**（第四键行 message 字面张力见 §4 MINOR-S1，已裁决不阻断） |
| ⑥ | 缺席目标 × 超限：投影文本照常计量、可报错 | 闸在投影之后、`value===undefined` 计 0 由构造保证；G6：`['nick']` × `maxBytes:26` 拒（measured 27 = 投影文本单通道）/ 27 收（value 显式 undefined、schema 非 null、truncated false） | **达成** |
| ⑦ | 无 options（含 `maxBytes` 缺席 ≡ 不设预算）逐字节现行为回归 | S2a 分支零改动；`maxBytes` 缺席/present-undefined/非 enumerable ≡ 无预算；G7 控制组锚表 R0–R12 逐锚复验（HEAD 即绿基线）；既有 27+5+2 readData 面套件零编辑全绿、F-x5=4/F-x6=5 descriptor 计数 parity 保持 | **达成** |
| ⑧ | 成功面恒四键、✂ 与头行文法零漂移（快照锚） | 成功组装体原样四键、不新增 bytes 键；canonical 在下传 resolver 前剥离 `maxBytes`（`options` 产物恒两键）→ 头行**结构上不可能**记录 `maxBytes`；`read-schema-projection.ts` 零 diff；G8 双侧：`{depth:1,maxBytes:415}.schema` 逐字节 === `{depth:1}.schema` 且不含 `maxBytes` 字样 | **达成** |
| ⑨ | registry lease：options 闭合形状与结果联合类型别名跟随，别名锁断言延伸 | registry `src/**` **零 diff**（lease raw 引用直传不变——透传语义的证据）；别名经 `NamespaceRuntimeReadDataOptions` / `NamespaceRuntimeReadDataBudgetResult` 按名单源自动跟随；`registry-readdata-budget-passthrough.test-d.ts` 原位扩展（`_runtimeOptionsClosedShape`/`_budgetExceededAliasFollow`/`_budgetExceededShape`/`_budgetExceededNoSuccessKeys` + 三键调用点 + 第四键编译红负例）；G9 行为 6 例（lease ≡ runtime 收/拒同载荷、released 三键短路、lifecycle、legacy 通道）+ 类型 surface 双锁 | **达成** |
| ⑩ | 包内门禁 + root `pnpm typecheck` / `pnpm test` | SA3 日志：包内 `tsc -p` ×2 exit 0；包内 vitest `--typecheck` 130 files/1258 tests exit 0；root typecheck（14 project）exit 0；root 全量 test **417 files / 5055 tests exit 0**（= 基线 412/5021 + 5 files/+34 tests，恰为新契约文件与用例数；零 skip/only/todo）；红灯基线独立复现红因单一（12× 未知键 `maxBytes`）；变异探针 M1/M2/M3 各自被断言捕获 | **达成**（证据为 SA3 本地实跑；CI 终态复跑为已登记流程项 RA-I4，见 §5） |

## 2. Issue「What to build」要件核对

| 要件 | 交付 | 判定 |
|---|---|---|
| `maxBytes` ≥1 有限整数 | `Number.isSafeInteger(v) && v >= 1`（split 与 canonical 双处同判据） | 达成 |
| 总量 = 值通道（紧凑 JSON、键序 = 交付序、undefined 计 0）+ schema 通道（投影文本 UTF-8、✂/头行自然计入、null 计 0） | `deliveryBytes` 逐字实现 | 达成 |
| ≤ 原样成功（与同参无 `maxBytes` 读逐字节相同） | 构造保证 + G1/G2 锚 | 达成 |
| > 零交付稳定码五键分支；`measuredBytes` 只报合计 | `readDataBudgetExceeded` 恰五键、合计载荷 | 达成 |
| 校验与度量住 namespace-runtime 组合层 | 全部生产改动集中 `runtime.ts` + 包内 helper | 达成 |
| doc-runtime / vfsl 零改动，下传 options 仍为两键 | DENY 面 git diff 全空（实测）；relay/canonical 双剥离 `maxBytes`，下传恒两键 | 达成 |
| registry lease options 与结果类型别名跟随透传 | 源码零改动、按名别名跟随 + 锁延伸 | 达成 |
| 契约词汇以 ADR 0031 与 CONTEXT.md「字节预算」词条为权威 | 实现语义与词条逐点一致（零交付/稳定码/合计/不裁剪/逐字节相同/缺席可超限/三面同码同文）；`_Avoid_` 全家排除（无裁剪路径、无部分交付、maxBytes 不进头行、失败分支无 ✂ 装配、载荷不拆分） | 达成 |

## 3. ADR 0031 与规范要求核对

| 条款 | 交付核对 | 判定 |
|---|---|---|
| 决策 1（三键 options、域 1..2^53−1、既有校验码、缺席 ≡ 不设预算、无魔法默认） | 三键自持 interface（runtime.ts L167–171）；域双处同判据；`2^53`/`2^53+2` 拒锚 ∧ `2^53−1` 接受锚同组（D2 未重开）；复用 `READ_OPTIONS_INVALID`，零新增校验码 | 达成 |
| 决策 2（规范度量、账本不进公共面） | 整体序列化即度量、构造性等式；成功面恒四键不加 bytes 键（`_budgetOkKeys` 锁） | 达成 |
| 决策 3（五键分支、合计、≤、不裁剪不降深不拟合、逐字节相同、三面同码同文同载荷形） | 五键分支 message 不含面标识（面区分靠调用现场）；文案已冻结为 OBL-WIN-1 窗口面票逐字镜像基准（JSDoc 明记） | 达成 |
| 决策 4（分层落点 + 零变化清单） | doc-runtime/vfsl/渲染器/头行/✂/`DeepOptional`/无 options 逐字节全部零变化（git diff 实测 + G7/G8 锚）；registry 别名跟随 | 达成 |
| 决策 5（缺席目标照常计量、终态非 no-op、where 无对撞） | G6/G3 锚；窗口面零触碰（无 ✂ 装配、无语义对撞面） | 达成 |
| 决策 6（使用指引进 typed-access 与作用域文档） | OBL-DOC-1 已兑现：`.agents/skills/nomicore/typed-access.md` L125「only the two budget keys」失真句清退 + 新增「Byte-budget reads: `maxBytes`」小节（域/总量/≤逐字节/五键/塑形后计量/缺席目标/决策 6 分工/确定性重试）；`cordis-plugin-hosting.md` 预算读段三键化；`external-project-vfsl-codegen.md` 补三键与五键词汇；「归调用方字节闸」grep 真空；doc-sync 门禁 43/43 绿（SA3 日志） | 达成（同变更集形态，SA6 §12.8 第 4 条允许） |
| 验收节（主接缝/度量 property/lease 透传/文档负控/门禁） | 逐条有 G 组与门禁日志对应 | 达成 |
| 验收节「发布随 minor bump（0.x 破坏性 minor）」 | **未随代码变更集落地**（`namespace-runtime` 版本未动）——SA8 登记 RA-I2：阻塞**发布**、不阻塞代码交付评审 | **挂账（须披露，见 §5）** |
| 修订节（ADR 0024/0027/CONTEXT 再修订链） | HEAD 已自洽、本票零触碰；B11 既有两键 Equal 锁随修订链原位演进为三键闭合形状锁且相邻注释同步重写（同变更集，RA-D2 闭合） | 达成 |
| docs/AGENTS.md「代码行为变化须同步规范文档」 | Phase B 三文档同变更集同步；ADR/CONTEXT 无需触碰（HEAD 已含 0031 修订） | 达成 |
| 模块 AGENTS（readData 同步、不进 sequencer、零缓存；lease 透传） | 组合体同步纯函数实读；lease raw 直传不变 | 达成 |

SA8 实现后冲突复审（`task_issue-405_implementation_conflict_report.md`，iteration 3）裁决 **`clear`**：十八项对照 no-conflict 10 / implements-existing-decision 8，hard-conflict 0、override 0；设计门禁 §5 十二项冻结面全部保持；`requiresConflictRecheck = false`。本 SA10 独立核对与其结论一致。

## 4. 评审发现与契约张力核对（不阻断项）

| # | 事项 | 状态 | 判定 |
|---|---|---|---|
| MINOR-S1 | SA6 §12.3 G5 第四键行（`{maxBytes:1,nope:1}`）字面要求 message「含 maxBytes 域标识」；实现按 DD-2 由 T1 单源以「未知键：nope」拒绝 | SA4 裁决实现侧正确（字面满足只能走 HEAD 未知键伪绿路径或复制 T1 message，均被 DD-2 否决）；SA8 §3 行 17 裁 no-conflict；组级判据（HEAD 红/实现后绿）不受影响；契约文本改写建议已登记 | MINOR，不阻断 |
| MINOR-S2 | G10 lifecycle 组 `descriptorCounting` 代理构造后未传入调用，`descriptorCalls()===0` 断言空转 | SA4 MINOR-1；主性质（lifecycle 先行）仍由码断言 + get-trap 0 次 + 代码序静态可证钉住 | MINOR，不阻断 |
| MINOR-S3 | relay 返回类型注解为三键 runtime interface 而非 doc-runtime 两键（行为等价） | SA4 MINOR-3（类型精度） | MINOR，不阻断 |
| MINOR-S4 | 非 plain 宿主 options 现被 `getPrototypeOf` 探测两次（split + T1）vs HEAD 一次；分类与 message 不变 | SA4 MINOR-5（观测面无影响） | MINOR，不阻断 |
| MINOR-S5 | 变异探针 M3：「非法 maxBytes 在 doc 触碰前短路」定序仅由 G5 message 域断言一条捕获线（码由 canonical 接缝兜底不变） | SA3 Deviation 4 / SA4 MINOR-6 如实登记；契约 D5 明示不钉死措辞 | 观察，不阻断 |
| MINOR-S6 | S2b-0 分支 fail-loud 不变式守卫 `throw`（G0 恒拒使其结构不可达） | SA3 Deviation 6 登记、SA4 §4 裁一致、SA8 §3 行 16 裁 no-conflict（非输入面失败通道，可观测输入面仍全数同步结果联合） | MINOR，不阻断 |

SA2 MINOR-1–4 处置（canonical 参数类型按 DD-3 落地、`Buffer.byteLength` 沿用并记录理由、R-2 残余与 HEAD 同族接受、registry 注释非契约载体）经 SA4 复核在案，无未落实的 Required revisions（SA2/SA4 Required revisions 均为空表）。

## 5. 必须随 PR 披露的未达成/挂账项（均为已登记递延，非本票 AC 缺口）

1. **OBL-WIN-1（RA-I1）**：窗口面 `readArray`/`readMap` 的 `maxBytes` 三面义务（同码同文、窗口同构度量、`WINDOW_OPTIONS_INVALID` 负控改写、message 逐字镜像本票冻结文案）属 **ADR 0031 决策 1 登记的独立票**；本票按 Issue 标题与正文限定 readData 面，窗口面零改动、携 `maxBytes` 维持 `WINDOW_OPTIONS_INVALID`（G11 递延期守卫绿）。挂账可追溯，不阻塞本票。
2. **RA-I2（发布门）**：ADR 0031 验收节「发布随 minor bump（0.x 破坏性 minor）」——`@nomicore/namespace-runtime` 版本未随本变更集 bump（当前 0.1.12）；公共面变化（三键 options + 新失败分支）不得以 patch 位发布。阻塞**发布**，不阻塞代码交付。
3. **RA-I3（测试基建后续票）**：readdata-docs 扫描器 `BUDGET_OPTION_KEYS` 仍为两键白名单；Phase B 文档措辞保持两键调用字面故门禁 43/43 绿，`maxBytes` 文档在场性暂由人工核验兜底（本次已核）。三键化前 SCOPE_DOCS 不得出现 `readData(x, {maxBytes})` 调用字面。
4. **RA-I4（CI 流程）**：root `pnpm typecheck`/`pnpm test` 全绿证据为 SA3 本地实跑（md5 与工作树一致、SA4 交叉核实）；CI 终态复跑为合并/交付流水线事项。
5. **ADR 0031 登记的演进位（非本票承诺，正确未实现）**：载荷拆分值/口径分项、可选裁剪模式（`over:'trim'` 开放问题）。

## 6. 范围与改动面核对

- 实际改动（排除 `wiki/**`、`artifacts/**`）恰为 SA1 §11 ALLOW 清单 13 条实现路径：runtime.ts、index.ts（纯注释）、5 个新契约/夹具、2 个原位类型锁修订、3 篇 Phase B 文档——**无越界**。
- DENY 面零 diff（实测 + SA3/SA8 复核）：`packages/doc-runtime/**`、`packages/vfsl*`、`read-schema-projection.ts`、`window-read.ts`、registry `src/**`、`CONTEXT.md`、`docs/adr`、`vitest.config.ts`、`tsconfig*.json`、`apps`、根 `package.json`。
- 既有测试/夹具/锚零编辑（F-x5/F-x6 计数、F6/F7 定序、投影快照常量全部保持并复跑绿）；B11 锁演进走已登记 ADR 修订链。
- `wiki/raw/**` 任务产物入提交为仓内惯例（`wiki/raw` 为受跟踪目录），非 scope creep。
- **无 scope creep**：未触碰窗口面实现、未引入裁剪/部分交付、未新增校验码、未做性能阈值断言、未改 doc-runtime/vfsl——非目标清单逐项保持。

## 7. 结论

最终交付忠实满足 Issue #405 正文与全部十条验收标准，ADR 0031 在本票范围面（readData）的决策与验收义务全部兑现，规范文档同步义务（OBL-DOC-1）已关闭；改动面干净、回归锚保持、反伪绿纪律在位。关键 AC 无 partial/unmet/unachievable。挂账项（OBL-WIN-1 独立票、发布 minor bump、scanner 三键化、CI 终态）均为已登记的非阻塞递延，须随 PR 披露（§5）。**approve**。
