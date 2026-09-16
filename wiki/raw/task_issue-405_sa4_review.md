# SA4 实现红队审查 — Issue #405 `readData 面：maxBytes 交付总量收/拒闸（tracer）`

- 派发：`sa-1e244591-6022-4c3f-8ff3-9aee9287fc59`（role `mabf-sa4`，phase `implementation-review`，iteration 0）
- Worktree：`/home/wangjian/nomicore-fix-issue-405`（branch `mabf/issue-405`，HEAD `fc6c1d3a4d…` = ADR 0031 入仓提交）
- 审查对象：当前工作区实现（生产 + 契约测试 + Phase B 文档）与 SA3 报告 `wiki/raw/task_issue-405_sa3_impl.md`（iteration 2）
- 审查方式：静态红队——独立实读源码/diff/测试/夹具/ADR/AGENTS/门禁配置，独立重推演关键机制（读次序 parity、类型传播、敌意面），交叉核对 SA3 证据日志与工作区实际状态（含 md5 比对）。未运行测试/服务，未修改实现/设计/测试。

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| `wiki/raw/task_issue-405.md`（简报，44 行） | 已读；AC①–AC⑩ 逐条核对；Comments 段空（REST 快照为空，无 owner 要求） |
| `wiki/raw/task_issue-405_design.md`（SA1 设计，399 行） | 已读；DD-1–DD-9、§8.1 组合次序、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-405_sa6_contract.md`（rev2，494 行，验收权威） | 已读；§12.0 锚表、§12.2–§12.5、§12.7 pins、§12.8 门禁清单 |
| `wiki/raw/task_issue-405_sa2_review.md`（`approve`，MINOR-1–4） | 已读；处置核对见 §3 |
| `wiki/raw/task_issue-405_design_conflict_report.md`（SA8 iteration 2，`clear`，RA-D1–RA-D5） | 已读；处置核对见 §3 |
| `wiki/raw/task_issue-405_relevant_decisions.md` | 已读（决策条款对照来源） |
| `wiki/raw/task_issue-405_sa3_impl.md`（iteration 2） | 已读；其 Deviations 1–6 逐项复核（见 §9/§12） |
| `docs/adr/0031-readdata-byte-budget.md`（母法） | 全文实读；决策 1–6 + 修订节 + 验收节逐条对照 |
| 源码独立复核 | `runtime.ts` 全量 diff + 实读（三键 interface / 预算联合 / readData 组合体 / `splitReadDataOptions` / `canonicalReadOptions` / `deliveryBytes` / `readDataBudgetExceeded` / `budgetAxisInvalid`）；`index.ts`（仅注释增量）；`doc-runtime/src/read.ts` L326–361（T1 读纪律逐行对照 split）；`read-schema-projection.ts`（头行两轴，零改动）；registry `lease.ts`/`types.ts`（零改动按名别名）；`window-read.ts`（五键键空间） |
| 测试独立复核 | 5 个新契约/夹具文件全读 + 2 个原位修订 diff（`runtime-readdata-shape-budget.test-d.ts`、`registry-readdata-budget-passthrough.test-d.ts`）+ 既有锚（`runtime-readdata-shape-budget-red.test.ts` F1/F3/F6/F7/F-x5/F-x6、fixture 构造器、`helpers/readdata-ok-shape.ts`、readdata-docs 夹具族与 sync-control/red 测试） |
| 环境事实 | `git status --porcelain --untracked-files=all`（7 modified + 5 新测试/夹具 + wiki/artifacts）；`md5sum` 实测 `runtime.ts=706d44a26fd50d90b729f23f9b3fc1f5`、`index.ts=362d7c9afadef8cef1babf514a5339ba` 与 SA3 日志声明逐一相符；`vitest.config.ts` include 与 `tsconfig.typecheck.json` 覆盖新文件；`@types/node` devDep 在位 |

## 2. Verdict

**`approve`** —— 无 BLOCKER、无 MAJOR。实现忠实落实 SA1 设计（DD-1–DD-9）、ADR 0031 决策 1–6 与 SA6 契约 G1–G12 的可满足面；ALLOW/DENY 范围干净；契约测试为真实行为测试且被真实 runner 发现；SA3 证据日志与工作区实际状态（md5、diff 面、测试计数算术）自洽。6 条 MINOR 观察不阻断（见 §12）。

核心理由（均为本评审独立复核所得）：

1. **读次序 parity 数学与实装一致（RA-D1）**。`splitReadDataOptions` 以与 T1 逐字同构的读形态（宿主门 → `Object.keys` 键空间 → 逐键显式 `getOwnPropertyDescriptor` data-property 取值、零 `[[Get]]`、整体 try 收编）成为 raw 第一读者，T1 改读 plain relay（零 trap）。对 1 键敌意对象独立重算：F-x5 型（第 3 次起抛）= split #1/#2 → canonical #3 抛 → re-split #4 抛 = **4**；F-x6 型（仅第 3 次抛）= split #1/#2 → canonical #3 抛 → re-split #4/#5 过 → 出口② = **5**——与既有冻结断言逐点相等；新增三键面（`{maxBytes:1}`）同计 4/5。总数上 raw 仍恰被读两次（split/canonical），每键 2 次 descriptor 读，与 HEAD 总量一致。
2. **T1 单源权威通过忠实中继保持**。非 plain 宿主（string/number/null/数组/Date/自定义原型）split 宿主门 raw 原样直传 → T1 单源 message；两轴/未知键/accessor `Object.defineProperty` 原样复制进 relay → T1 继续作两轴域与未知键的单一权威（`{maxBytes:1,nope:1}` 仍以「未知键：nope」被拒）；split 只消费 T1 结构上看不到的 `maxBytes` 域（与 `canonicalWindowBudget`/`seamReadOptionsInvalid` 既有先例同族，非平行机制）。
3. **度量等式构造性成立（ADR 决策 2）**。`deliveryBytes = (value===undefined?0:utf8(JSON.stringify(value))) + (schema===null?0:utf8(schemaText))`；闸门在投影组装之后、恒四键组装之前，成功路径不触碰已组装交付物（逐字节相同由构造保证）；失败分支恰五键、`echoReadPath` 新鲜回显。
4. **类型传播链闭合且零导出扰动**。三键自持 interface + 联合追加 `ReadDataBudgetExceededResult`（包内名，`index.ts` 导出键集零变化——实读 export 块证实仅按名导出既有别名）；registry 源码零改动、按名单源别名自动跟随（lease.ts 实读）；B11 两键锁原位三键化且相邻注释同步重写（RA-D2）；legacy 联合与 `ReturnType` 末签名锚零变化。
5. **证据可信**。SA3 日志的红灯基线（14 failed / 14 passed、红因单一）、门禁（root typecheck exit 0、417 files/5055 tests = 基线 +5 files/+34 tests，恰等于 5 个新契约文件与 14+8+6+3+3 用例）、变异探针 M1/M2/M3 与 md5 恢复声明全部与工作区实际状态交叉相符。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| Issue AC① 总量 ≤ 预算成功、逐字节一致 | `issue-405-maxbytes-red.test.ts` G1×2（R0 total/100000 宽预算 `toStrictEqual` 四键全等 + `schema` 逐字节；复合三键 `{depth:1,maxBytes:415}` + 塑形后 414 必拒） | 落实（SA3 日志 §[2] 绿） |
| AC② 恰好等于成功（≤） | G2：R0/R6/R7/R11/R8 五锚 total 收 / total−1 拒成对；R8 零总量 `maxBytes:1` 收 | 落实 |
| AC③ 超限零交付五键分支 | G3×2：恰五键 own 键集、`measuredBytes` 合计且 ≠ 单通道（358≠120≠238）、path 新鲜回显 + 实参变异隔离、R7/R9 单通道锚 | 落实 |
| AC④ 度量等式 property | G4：R0–R7/R11 + R9/R10 共 11 锚成对 + 独立 oracle（`measureChannels` 从同参无预算读独立测量，绝不消费被测 `measuredBytes`） | 落实 |
| AC⑤ options 负控 + 域区分 + C-LIMIT | G5：0/负/1.5/NaN/Infinity/string/2^53/2^53+2 矩阵全 `READ_OPTIONS_INVALID` 恰四键、message 含 maxBytes 且与未知键 message 不同；**同组**有效域接受锚（`2^53−1` 成功逐字节相同、`{maxBytes:1}` 报预算码而非校验码） | 落实（组级判据在位；第四键行的 message 字面偏差见 §12 MINOR-2） |
| AC⑥ 缺席目标 × 超限 | G6：`['nick']` 26 拒（measured 27 = 投影文本单通道）/ 27 收（value undefined、schema 非 null） | 落实 |
| AC⑦ 无 options 逐字节回归 | G7 控制组：锚表 R0–R12 逐锚复验（值/schema/total/truncated/头行），HEAD 即绿 | 落实 |
| AC⑧ 恒四键 + ✂/头行零漂移 | G8 双侧：带预算侧 `{depth:1,maxBytes:415}.schema` 逐字节 === `{depth:1}` 且不含 `maxBytes` 字样、头行文法冻结；无预算侧文法锚 | 落实 |
| AC⑨ lease 别名跟随 + 锁延伸 | G9 行为 6 例（真实装配逐字段相等、raw 引用直传、released 三键短路、lifecycle、legacy）+ 类型（`_readBudgetAlias` 延续、options 跟随、五键 `Extract`、doc-runtime `keyof` 恰两键硬锁、末签名锁、EOPT 负例） | 落实 |
| AC⑩ 门禁 | SA3 日志：包内 tsc×2 + vitest `--typecheck`（130 files/1258 tests）+ root `pnpm typecheck` exit 0 + root `pnpm test` 417/5055 exit 0 + DENY 面 diff 空 + 零 skip/only/todo（本评审独立 grep 复核为空） | 落实 |
| SA6 §12.0 冻结 fixture 与锚 | `issue-405-maxbytes-fixture.ts`：TXT/种子/锚常量 R0–R12 与 §12.0 逐行同构（本评审逐值比对：120/238/358、57/358/415、…、231/238/469 全符）；`anchorById` 缺席 loud throw | 落实 |
| SA6 §12.3 G10/G11 | G10：路径失败先于预算、校验先于度量、lifecycle 先于 options（get trap 0 次）、accessor getter 0 次、非 enumerable ≡ 无预算、present-undefined ≡ 缺席、状态化/交替 trap 计数 4/5；G11：窗口面/doc-runtime 面携 `maxBytes` 各走其码 | 落实（lifecycle 组内一处断言空转，见 §12 MINOR-1） |
| SA2 MINOR-1（canonical 参数类型矛盾） | `canonicalReadOptions(raw: NamespaceRuntimeReadDataOptions)` 放宽三键（正确解）；`relay` 用三键 runtime interface 而非 SA2 建议的两键类型（行为等价，见 §12 MINOR-3） | 已消解（括注矛盾不复存在） |
| SA2 MINOR-2（`Buffer.byteLength` vs `TextEncoder`） | 沿设计 `Buffer.byteLength`；`@types/node` devDep 在位；理由写入 `deliveryBytes` JSDoc | 记录不处理（skill 允许） |
| SA2 MINOR-3 / MINOR-4 | 与 HEAD 同族接受残余 / registry src 属 DENY 注释不改 | 记录在案 |
| SA8 RA-D1（split parity = 实现验收） | 本评审独立重算 4/5 保持；既有 F-x5/F-x6 与三键面 4/5 断言在契约内（G10 第 5 例）且 SA3 日志复跑绿 | 落实 |
| SA8 RA-D2（B11 锁同变更集 + 相邻注释） | 同一工作区变更集完成，失真注释「doc-runtime 单源类型别名（零复制）」已重写为三键锁说明 | 落实 |
| SA8 RA-D3 / OBL-DOC-1 | Phase B 三文件重录已落地（typed-access L125 句清退 + `### Byte-budget reads: maxBytes` 小节含域/总量/≤逐字节/五分支/塑形后计量/缺席目标/决策 6 分工/确定性重试；cordis 预算读段三键化 + maxBytes 语义；codegen readData 段补词汇）；「归调用方字节闸」grep 三文件 0 命中（真空核实）；doc-sync 门禁 43 tests 绿（本评审静态求值 `readDataOptionUsages` 三文件均 0 违规） | 落实（同变更集形态） |
| SA8 RA-D4（实现后复审） | SA3 派发已置 `requiresConflictRecheck=true`；本评审核对其 §5 冻结面（恒四键、✂/头行、doc-runtime 两键、无新校验码、legacy 零泄漏、lease 直传）全部保持，未发现**新增** ADR 冲突面 | 落实（SA4 侧不重复触发） |
| SA8 RA-D5 / OBL-WIN-1 | 窗口面零触碰（git status 证实）；G11 递延期守卫（`WINDOW_OPTIONS_INVALID`）；超限 message 常量冻结为窗口面票镜像基准 | 落实（挂账延续） |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| DD-1 组合边界（全部改动住 runtime 组合体） | `runtime.ts` readData 组合体 + 包内 helper；doc-runtime/vfsl/渲染器/窗口面零 diff（git status 证实） | 一致 | — |
| DD-2 拆分读 + 忠实中继 | `splitReadDataOptions`（runtime.ts ~L1210–1250）：宿主门 raw 直传、`maxBytes` accessor 拒/present-undefined 剥离/域拒、其余键 `defineProperty` 原样复制、谎报键跳过、try 收编 | 一致（读形态与 T1 逐字同构，本评审逐行对照 doc-runtime read.ts L326–361） | — |
| DD-3 canonical 三键扩展 + 出口① re-split | `canonicalReadOptions` 三键白名单、`maxBytes` 域复读 + 剥离回传（`options` 恒两键）；出口① 改 re-split + re-T1(relay₂)；出口② seam 不变 | 一致 | — |
| DD-4 度量与收/拒闸 | 闸门在 `projectReadDataSchema` 之后、恒四键组装之前；预算权威 = `canonical.maxBytes`；`deliveryBytes` 构造性等式；`>` 拒 / `≤`（含零总量）收 | 一致 | — |
| DD-5 类型面与 lease 传播 | 三键自持 interface、`ReadDataBudgetExceededResult` 追加联合（包内名）、registry 源码零改动按名跟随、B11 锁原位三键化 | 一致 | — |
| DD-6 design pins D1–D7 | D1 ≡ 缺席（split/canonical 双剥离，G10 断言）；D2 域 1..2^53−1（`Number.isSafeInteger && ≥1` 双处同判据，`2^53` 拒锚 + `2^53−1` 接受锚同组）；D3 runtime 自持；D4 白名单三键 + 下传前剥离；D5 message 三常量（域可区分、非钉死）；D6 窗口面不动；D7 头行不记（canonical 剥离 → 结构保证） | 一致 | — |
| DD-7 message 文案 | 三常量与设计建议值逐字一致；超限文案冻结为 OBL-WIN-1 镜像基准 | 一致 | — |
| DD-8 失败优先级阶梯 | S1 lifecycle → S2b-0 G0（零 options 读取）→ split 域拒 → T1(relay) → canonical 出口①/② → 投影 → 闸门 → 四键；F6/F7/T8 定序锚全绿 | 一致 | — |
| DD-9 OBL-DOC-1 | Phase B 三文件重录（同变更集形态落地，内容逐项对照 SA6 §3.3 台账） | 一致（scanner 两键偏窄为已披露递延，见 §12 MINOR-4） | — |
| §8.1 伪代码 ↔ 实装 | S2a/S2b-0/…/S2b-5 逐步对应；S2b-0 落地多出 fail-loud 不变式守卫 throw（SA3 Deviation 6 如实登记——G0 恒拒使成功分支不可达，守卫满足类型收口，正常路径零影响） | 一致（如实登记的微偏离，非语义变化） | — |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| `maxBytes` 校验与度量 | 唯一同时见两通道的组合层（ADR 0031 决策 4） | runtime.ts readData 组合体 + 包内 helper | 正确；无应用层复制 |
| 两轴域/未知键/宿主校验 | doc-runtime T1 单一权威 | split 忠实中继 → T1(relay) | 正确；message 单源不漂移 |
| 净化（canonical） | runtime 接缝（#336 先例） | 三键白名单 + `maxBytes` 剥离/回传 | 正确 |
| 预算值权威 | canonical 后读（与投影通道同源） | 闸门消费 `canonical.maxBytes` | 正确 |
| lease 透传 | registry 零解释直传 | lease.ts 零改动（raw 引用直传断言在 G9） | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 组合层同纪律重读 helper | `canonicalWindowBudget`（window-read.ts，`Object.keys` + 逐键 gOPD + try 收编） | `splitReadDataOptions` | 一致 | 同款「判据镜像、非第二权威」 |
| runtime 构造 options 失败成员 | `seamReadOptionsInvalid`（D1 豁免登记先例） | `budgetAxisInvalid`（形状由 `ReadLogicalValueBudgetFailure` 单源类型注解锁死） | 一致 | 豁免逻辑成立（T1 两键视野内不可观测 maxBytes 域） |
| runtime 自持失败成员 | `RuntimeReadDisabledResult` | `ReadDataBudgetExceededResult`（不新增公共导出名） | 一致 | 先例同款 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| `maxBytes` 预算值（闸门） | canonical 复读 | split 前置域判定只服务定序、不供闸门 | 低（判据双处同款为既有模式延伸） |
| T1 失败 message | doc-runtime 单源 | relay/raw 直传保证透传 | 低（探测期收编措辞为一处镜像字符串，非契约字段） |
| 字节度量 | `deliveryBytes` 构造式 | 无镜像（测试 oracle 独立构造同式） | 低 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 无新资源（同步纯读；relay/canonical/失败分支均新鲜对象，不逃逸不缓存；不进 sequencer——runtime AGENTS「Reads stay outside that sequencer」保持） | 无需释放 | 同参重读确定性重放；`echoReadPath` 隔离实参事后变异 | 对称 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套 options 校验通道 | T1 + canonical | split | 非平行：split 不判两轴/未知键/宿主，仅消费 T1 结构上看不到的 `maxBytes` 域 |
| 消费侧字节闸 | ADR 0031 已裁决收回引擎 | 引擎内五键分支 | 无残留平行通道（文档同步清退） |
| 新校验码 | `READ_OPTIONS_INVALID` 既有词表 | 复用；唯一新码 `READ_BUDGET_EXCEEDED` 为 ADR 决策 1/3 明文 | 一致 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-runtime/src/runtime.ts`（+307/−39） | Phase A 第 1 行 | 全部生产面改动 | 符合 |
| `packages/namespace-runtime/src/index.ts`（+9，纯注释） | Phase A 第 2 行（仅注释） | `#405 增量` 说明；export 语句区零改动（实读证实） | 符合 |
| `packages/namespace-runtime/test/issue-405-maxbytes-fixture.ts`（新，191 行） | Phase A 第 3 行 | §12.0 冻结 fixture + 锚 + oracle | 符合（非 `*.test.ts`，不被收集） |
| `packages/namespace-runtime/test/issue-405-maxbytes-red.test.ts`（新，476 行/14 例） | Phase A 第 4 行 | G1–G6/G8(带预算侧)/G10 | 符合 |
| `packages/namespace-runtime/test/issue-405-maxbytes-control.test.ts`（新，239 行/8 例） | Phase A 第 5 行 | G7/G8(无预算侧)/G11 | 符合 |
| `packages/namespace-runtime/test/issue-405-maxbytes.test-d.ts`（新，151 行） | Phase A 第 6 行 | 类型面 | 符合 |
| `packages/namespace-runtime/test/runtime-readdata-shape-budget.test-d.ts`（原位修订） | Phase A 第 7 行（B11/RA-D2） | 两键 Equal 锁 → 三键闭合形状锁 + 相邻注释重写 | 符合 |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-passthrough-red.test.ts`（新，244 行/6 例） | Phase A 第 8 行 | G9 行为 | 符合 |
| `packages/namespace-registry/test/issue-405-lease-maxbytes-surface.test-d.ts`（新，130 行） | Phase A 第 9 行 | G9 类型 | 符合 |
| `packages/namespace-registry/test/registry-readdata-budget-passthrough.test-d.ts`（原位扩展 +45） | Phase A 第 10 行 | 别名锁延伸 | 符合 |
| `.agents/skills/nomicore/typed-access.md` / `docs/integration/cordis-plugin-hosting.md` / `docs/integration/external-project-vfsl-codegen.md` | Phase B 三行 | OBL-DOC-1 重录 | 符合（同变更集形态；SA6 §12.8 第 4 条允许） |
| `wiki/raw/task_issue-405_sa3_impl.md`、`artifacts/sa3-issue405-verification.log` | 证据类 | SA3 固定产物/日志 | 符合仓内惯例 |
| DENY 面（doc-runtime、vfsl、read-schema-projection.ts、window-read.ts、registry `src/**`、CONTEXT.md、docs/adr、vitest.config.ts、tsconfig*.json、apps、package.json） | — | — | **零 diff**（git status 全量核对 + SA3 日志 §[5]） |

结论：实际改动恰为 ALLOW 清单 13 条实现路径 + 证据产物，无越界、无 DENY 触碰。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| `readData` 预算重载三键 + 五键分支 | TS 消费方 | 破坏性 minor 已由 ADR 0031 验收节明示授权；`Extract<…,{code}>` 结构可达 | 无 | — |
| `lease.readData` 双重载 | registry 消费方 | 源码零改动、按名单源别名自动跟随；G9 行为+类型锁 | 无 | — |
| 单参 legacy 通道 | `apps/yjs-server/src/app.ts` L612（仓库唯一生产调用点，单参） | legacy 联合零变化、`ReturnType` 末签名锚延续 | 无 | — |
| 窗口面 `readArray`/`readMap` | 窗口消费方 | 五键键空间不含 `maxBytes` → 现行 `WINDOW_OPTIONS_INVALID`（G11 锚定，D6 守卫零改动自然保持） | 无 | — |
| doc-runtime 直调 | 直调消费方 | 两键冻结 + `{maxBytes:1}` → `READ_OPTIONS_INVALID`（G11/N11 + `keyof` 硬锁） | 无 | — |
| 公共导出面 | public-surface guard | 值导出仍恰 `RuntimeWriteFatalError`；类型导出键集零变化 | 无 | — |
| 无 options / 两键 options 行为 | 既有全部 readData 面测试 | 逐字节不变（G7 + 既有 27+5+2 套件全绿 + F-x5/F-x6 计数保持） | 无 | — |

## 8. 错误、恢复与并发

| 检查点 | 结论 |
|---|---|
| 静默失败 | 无：全部失败同步结果联合（非抛、非 Promise）；split/canonical 探测期 trap 各自 try 收编为 `READ_OPTIONS_INVALID`，绝不外抛；唯一 throw 逃逸通道仍是可信域 `InternalError`（投影面，不变）；S2b-0 的不变式守卫 throw 在正常路径不可达 |
| 部分完成 | 无：超限零交付（失败分支无 value/schema/truncated）；无资源获取即无回滚需求 |
| 错误分类稳定性 | 码集稳定：`PATH_NOT_ALLOWED`/`READ_OPTIONS_INVALID`/`READ_BUDGET_EXCEEDED`/`RUNTIME_READ_DISABLED`（+ lease `NAMESPACE_LEASE_RELEASED`）；不借码（G10 锚定校验 ≠ 预算码） |
| 重试幂等 | 同参重读确定性重放（同步纯函数、零缓存零订阅、不进 sequencer——runtime AGENTS 纪律保持） |
| TOCTOU / 双读漂移 | 敌意对象 split 与 canonical 两读间域内漂移/键消失 → 预算静默脱落：与 HEAD 对 `depth` 的既有处置同款（canonical 判据判定、不做键集比对），SA2 MINOR-3 已登记为接受残余，本实现未扩大该面（闸门与投影通道消费同一次 canonical 后读） |
| lifecycle 竞态 | S1 gate 在组合之前、先于一切 options 读取（代码序静态核实：`state.lifecycle` 检查在 options 首次触达之前）；closing/closed 期敌意 trap 零执行（G10 get-trap 0 次实测锚） |
| 读次序 parity | F-x5=4 / F-x6=5 及三键面 4/5 保持（本评审独立重算 + SA3 日志复跑） |

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| `issue-405-maxbytes-red.test.ts`（14 例） | G1–G6/G8/G10：逐字节一致、边界成对、五键零交付、度量等式（独立 oracle）、域区分 + C-LIMIT 组级、缺席目标、头行零漂移、优先级阶梯与敌意面（accessor/非枚举/present-undefined/trap 计数 4/5） | `vitest.config.ts` L15 include；红灯基线 12/14 红、红因单一（SA3 日志 §[1]） | 第四键行 message 断言为「与 `{nope:1}` 同源」而非 SA6 §12.3 字面的「含 maxBytes 域标识」——见 §12 MINOR-2（HEAD 上该行仍红：HEAD 的组合输入 message 命名 `maxBytes`，灵敏度保持） | MINOR-2 |
| `issue-405-maxbytes-control.test.ts`（8 例） | G7 锚表逐锚复验 + 头行文法冻结 + R7/R8 语义 + G11 窗口/doc-runtime 负控 + 装置前提 fail-loud | 同上；HEAD 即绿 8/8（§12.4 判定自洽） | 无 | — |
| `issue-405-maxbytes.test-d.ts` | 三键闭合/第四键编译红/五键 `Extract`/零泄漏/doc-runtime 两键硬锁/末签名/EOPT 负例 | vitest `--typecheck`（tsconfig.typecheck.json include 覆盖） | 无 | — |
| `issue-405-lease-maxbytes-passthrough-red.test.ts`（6 例） | lease ≡ runtime 逐字段（收/拒）、raw 引用同一性、released 三键短路 + 零 runtime 触达、lifecycle 同走、legacy 通道 | L15 include；HEAD 2/6 红 | 无 | — |
| `issue-405-lease-maxbytes-surface.test-d.ts` | 别名组合锁延续/options 跟随/五键形状/零成功键/末签名/EOPT | `--typecheck` | 无 | — |
| G10 lifecycle 组（red 文件第 3 例） | `RUNTIME_READ_DISABLED` + get-trap 0 次 | 同上 | `descriptorCounting` 代理构造后**从未传入任何调用**，其 `descriptorCalls()===0` 断言恒真（空转）——「任何 options 探测零触达」的 descriptor 通道证据缺位；主性质（lifecycle 先行）仍由码断言 + fail-loud 前提 + get-trap 计数钉住，且代码序静态可证 | MINOR-1 |
| 既有锚保持 | F1/F3/F4/F6/F7/F-x5/F-x6、registry passthrough、投影快照 | 既有 include | 零编辑（DENY）；SA3 日志 27+5+2 全绿 | — |
| 敏感性 | 变异探针 M1（`>`→`>=`：6 failed）、M2（丢 schema 通道：7 failed）、M3（split 域判定失效：1 failed——message 域断言为唯一捕获点，SA3 Deviation 4 如实登记） | 日志 §[6]，源码 md5 前后一致 | M3 表明「域拒先于导航」的定序事实仅由 message 断言承载可观测性（码不变有 canonical 接缝兜底）——契约 D5 明示不钉死措辞，组级判据不受影响 | 观察（MINOR-6） |
| 反伪绿纪律 | 期望 = §12.0 冻结常量或同参无预算读独立测量（R1）；成功恰四键/失败恰五键显式键集（R3）；CJK 锚对度量单位敏感（R4）；单通道锚（R5）；塑形后计量锚（R6）；零 skip/only/todo、零源码字符串断言（本评审独立 grep 证实） | — | 无 | — |

## 10. Required revisions

无 BLOCKER、无 MAJOR——空表。

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| CI/目标环境复跑（现有全绿证据为 SA3 本地运行，虽经 md5 与工作区比对一致） | CI 流水线执行 root `pnpm typecheck` + `pnpm test` | exit 0；417 files / 5055 tests（或以上）；Type Errors: no errors | 任何红测/类型错误 |
| 全量套件在 CI 机器上的时长与稳定性（本地 610s） | CI | 正常超时预算内完成，零 flake | 间歇性失败 |
| 发布门禁：ADR 0031 验收节「发布随 minor bump（0.x 破坏性 minor）」 | 发布流程 | `@nomicore/namespace-runtime` minor bump（当前 0.1.12 → 0.1.13）随本变更 | 以 patch 位发布破坏性公共面变化 |
| doc-sync scanner 三键化后续票（SA3 Deferred #4 已登记） | 后续票 | `BUDGET_OPTION_KEYS` 纳三键后 43 门禁保持绿 | 新票误伤 `maxBytes` 文档用法或漏扫描 |

## 12. Non-blocking observations

| # | 观察 | 建议 | 严重度 |
|---|---|---|---|
| MINOR-1 | G10 lifecycle 组构造了 `descriptorCounting`（`statefulDescriptorProxy({maxBytes:1}, Infinity)`）但从未把它传入任何 `readData` 调用——其 `descriptorCalls()===0` 断言恒真（空转），「任何 options 探测零触达」在 descriptor 通道无实测证据。主性质不受影响：码断言 + fail-loud 前提 + 已传入 proxy 的 get-trap 0 次 + 代码序（lifecycle 检查先于 options 首次触达）静态可证；gate 若被移到 options 校验之后，该输入会翻成成功/校验码并被前提 helper 捕获 | 后续触碰该文件时把 `descriptorCounting.options` 接入一次 closing/closed 期调用（或删除该死代理），使「零 descriptor 探测」断言获得真实输入 | MINOR（测试精度） |
| MINOR-2 | SA6 §12.3 G5 第四键行（`{maxBytes:1, nope:1}`）字面要求 message「含 maxBytes 域标识且与未知键 message 不同」；实现按设计 DD-2 由 T1 单源拒绝（message 命名 `nope`、与 `{nope:1}` 同文）。**SA4 裁决：实现侧解正确**——字面 (a) 若被满足只能是 HEAD 的未知键路径（`maxBytes` 恰为首键被 T1 命名），属 SA6 自己警示的伪绿吸引子（§5 P4/R2）；满足字面须复制 T1 message 或在 split 复制未知键判据，两者均被 DD-2 否决。组级判据（HEAD 红/实现后绿）不受影响——HEAD 上该行 message 命名 `maxBytes`，测试断言同源性即红，灵敏度保持 | SA6 契约下次被触碰时把第四键行的 message 要求改写为「T1 单源 message（与 `{nope:1}` 同文）」，消除字面与 DD-2 的张力 | MINOR（契约文本精度） |
| MINOR-3 | `splitReadDataOptions` 的 `relay` 返回类型注解为三键 `NamespaceRuntimeReadDataOptions`，而非 SA2 MINOR-1 建议与 DD-2 伪码的 doc-runtime 两键类型（该 import 已整体移除）。行为等价（relay 运行时永不含 `maxBytes`、可含中继未知键——两种注解对此都不精确）；T1 调用点结构兼容 | 可在后续触碰时把 relay 注解改为最小诚实面（如 `{ readonly [k: string]: unknown }` + JSDoc），非必要 | MINOR（类型精度） |
| MINOR-4 | readdata-docs 扫描器 `BUDGET_OPTION_KEYS` 仍为两键（SA3 Deferred #4 已披露递延）；Phase B 文档措辞使首个 `readData(...)` 匹配保持两键形态从而门禁绿（本评审静态求值三文件 0 违规）——正面 `maxBytes` 词汇在场性不由该门禁机器强制，靠本次人工内容核验兜底 | 后续票把 scanner 白名单纳三键（SA3 已登记） | MINOR（门禁滞后，已披露） |
| MINOR-5 | 非 plain 宿主 options 现在会被 `getPrototypeOf` 探测两次（split 宿主门 + T1 对 relay=raw 的宿主门）vs HEAD 一次；无任何测试计数该通道（SA8 B7 事实核对确认），分类与 message 不变 | 无需动作（登记即可） | MINOR（观测面无影响） |
| MINOR-6 | 变异探针 M3 显示「非法 `maxBytes` 在 doc 触碰前短路」（DD-2/DD-8 定序）仅有 G5 的 message 域断言一条可观测捕获线（码由 canonical 接缝兜底不变）；契约 D5 明示不钉死措辞、组级判据不受影响 | 无需动作；窗口面票（OBL-WIN-1）落地时如需更强定序锚可补「零 doc 触达」计数断言 | 观察 |

## 收尾声明

本评审只审查实现与证据（源码、diff、测试、夹具、ADR、AGENTS、日志、md5/git 只读状态），未运行测试/服务、未修改实现/设计/测试。`approve` 表示实现通过静态红队审查；CI 终态与发布门禁见 §11。未发现新增 ADR 冲突风险（SA8 RA-D4 所列实现后复查面已逐项核对为保持），故本评审不重复触发 conflict recheck。
