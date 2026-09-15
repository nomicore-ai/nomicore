# SA7 动态验证报告 — issue #383：[ADR 0029] P3 组合面与 lease 类型（缝 2：runtime + registry）

- 被验对象：worktree `/home/wangjian/nomicore-fix-issue-383`（branch `mabf/issue-383`，HEAD `de2ff55` 之上的未提交实现 diff：`window-read.ts`/`runtime.ts` + 四文档 + 5 个 `issue-383-*` 测试/fixture）。
- 验证人：SA7（mabf-sa7，dispatch `sa-b7e13cdc-e388-41ad-9048-9ccc952334d2`，final-verification iteration 0）。
- 验证方式：动态（真实 runner 复跑 + 独立探针活链路取证）；未修改任何生产/实现/测试文件（本报告为唯一新增产物）。
- SA4 前置：`task_issue-383_sa4_review.md` verdict **approve**（3 MINOR 观察不阻断）——本验证在其基础上独立复核 §10 全部四项动态验证项，**未发现可致 fail 的新事实**。

## 1. Inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-383.md`（AC1–AC8；评论 REST 快照 `[]`，无 Owner 评论） | 验收面 |
| `wiki/raw/task_issue-383_sa6_contract.md`（approve；B-1–B-15、§12.3 用例组、§5 O 组缺口证据、§15-O4） | 行为契约与判据锚 |
| `wiki/raw/task_issue-383_design.md`（iteration 1；§5.1–§5.6、§7 ALLOW/DENY、§8、§9 数据流五跳） | 设计声明的改/不改路线 |
| `wiki/raw/task_issue-383_sa3_impl.md`（实现报告；自报运行证据） | 被独立复跑的声明 |
| `wiki/raw/task_issue-383_implementation_conflict_report.md`（SA8 implementation 复查 clear；A-I1 两项交接事实） | 冻结面与交接事项 |
| `wiki/raw/task_issue-383_sa4_review.md`（approve；§10 后续动态验证项 4 条 + §11 观察 3 条） | SA7 重点风险清单 |
| `docs/adr/0029-filtered-window-read.md` §1–§8、`CONTEXT.md` L61–67 | 语义权威 |

## 2. Runtime environment

| 项 | 值（实测） |
|---|---|
| worktree / branch / HEAD | `/home/wangjian/nomicore-fix-issue-383` / `mabf/issue-383` / `de2ff55571e3d91a3b1bde3a761154c2fade6242` |
| 实现 diff 在场性 | `git status --porcelain`：恰 6 modified（`window-read.ts`/`runtime.ts`/`AGENTS.md`/`typed-access.md`/`SKILL.md`/`cordis-plugin-hosting.md`）+ 5 个 `issue-383-*` 新测试/fixture + wiki 产物——与 SA3 Changed paths 逐一吻合，无超范围文件 |
| 工具链 | node v24.13.0；pnpm 10.28.2；vitest 3.2.7；tsx（探针）；tsc 5.9.3（typecheck 段） |
| 测试入口 | `pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；include `packages/*/test/**/*.test.ts` + typecheck include `**/*.test-d.ts`；`maxWorkers: 1` |
| 本地验证分类 | 全部为**本地验证**（本机 runner 实跑）；无 CI 观察义务（SA7 不等 PR CI）；无环境阻塞项 |

## 3. Changed Data Flow Verification（设计 §9 跳 1–5；缝 2 声明改变的路线）

探针：`packages/namespace-registry/test/__sa7_383_probe.mts`（临时，已删，§8）——自建 schema/doc（原生 Yjs，零复用 SA3 fixture）、`MemoryPersistence`+`createNamespaceRuntimeWithSeam` 构造 runtime、`createNamespaceRegistryForTesting`+同 doc Stub 打开 lease；期望全部由独立预言机派生（原生 Yjs 直数、W1 直调、同一次运行的公共面 `readData`/全量窗读）。结果 **38/38 PASS，exit 0**（`/tmp/sa7-383-probe.out`）。

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| 跳 3 runtime → W1：`where` 过滤 + `total` 双形态 | W1 已交付（#398），缝 2 不动 W1 | W1 直调 `readMapWindowAtPath(doc,['tasks'],{n:5,where:claimed})` / `{n:2}` | W1 有 where：`total === undefined`、条目=[t1,t3,t5]（=原生预言机）；无 where：`total === 5`（=原生 size） | B-8 单源不变量在场 | P03a/b/c 全 PASS | ✅ |
| 跳 4 组合层 S6 双语义 | `truncated = total === undefined ? kept === canonical.n : kept < total`；判据键于 W1 单源 | `runtime.readMap(['tasks'],{n:5\|3\|2,where})`、`exactTasks{n:5}`、`bigTasks{n:5\|3}` | kept 3<5→false；3===3→true；2===2→true；exactTasks 恰 5 匹配 n=5→**true**（计数型实现必红）；bigTasks 3<5→false、3===3→true；条目集=原生预言机切片 | AC2/B-5 装满判定 | P04 五边界全 PASS | ✅ |
| 跳 4 ✂ 永不装配 + schema 通道 | 有 where `schema === anchor` 原样；无 where 逐字节装配 | `readMap({n:2,where}).schema` vs `readMap({n:5}).schema` 字节比较；where 读 `includes('✂ 截断事实：')` | 有 where 两 schema **字节相等**且无 ✂；where 不影响元素口径正文 | AC2/B-6/X1 | P01d/P05 PASS | ✅ |
| 跳 4 单源判据（不重读 options） | S3 视图隐藏 where 不得改变结算 | 状态化 options Proxy：视图①(W1)=`{n:2,where}`、视图②(S3)=`{n:2}`；get trap 抛错 | `ok:true`、keys=[t1,t3]（按 W1 已过滤）、`truncated=true`（2===canonical n 2）、无 ✂、恰 2 次校验 pass、get trap 零命中 | SA6 §15-O4 / SA8 A3；「重读 options 判定」变异必红 | P11 PASS（passes=2, getCalls=0） | ✅ |
| 跳 4 管线序 where→orderBy→n | 过滤权威只在 W1，组合层零筛选零排序 | `{n:2,where,orderBy:{field:'priority',dir:'desc'\|'asc'}}` | desc→[t3,t1]；asc→[t5,t1]（原生 priority 直数对账） | B-3/T12；「先取窗后过滤」变异必红 | P07 PASS | ✅ |
| 跳 4 条目身份 + 组合式 depth 等价 | index/key 原位不重编号；条目值=W1 物化直通 | `readArray(['taskList'],{n:2,where})`→indexes=[0,2]；`[...path,2]` 深读 ≡ entry.value；`readMap({n:5,where,depth:1,maxChildrenPerNode:2})` 逐条目 ≡ `readData(['tasks',key],同预算)` | 深读回环 `toStrictEqual` 等价；逐条目同预算等价 | AC3/AC4/B-10/K3-K4/D1-D2 | P08/P09 PASS | ✅ |
| 跳 4 组合层零重物化/零重过滤 | 未匹配项不得被组合层重走 | `poisonScored`（2000 条、未匹配项 `payload:NaN`）`{n:2,where,depth:1}` | `ok:true`、恰 2 命中、逐条目 ≡ 同预算 readData；**无** `PATH_NOT_ALLOWED`（重走未匹配项必得此码） | ADR 0029 §3/§8；D5/S3 毒埋 | P25c PASS | ✅ |
| 跳 5 lease 透传 | raw 引用直传、零解释 | 同 doc 双面：`lease.readMap(同参)` vs `runtime.readMap(同参)` | **逐字段 deep-equal 相等**（value/schema/truncated/ok） | AC6/L1/T11 | P02 PASS | ✅ |
| 调用方目标能力 | lease 面「找所有 state=='claimed' 的 task」+ 截断信号可读 | `lease.readMap(['tasks'],{n:5,where:claimed})` | `ok:true`、恒四键 own 键集 `{ok,schema,truncated,value}`、`'total' in result === false`、条目=[t1,t3,t5]、truncated=false（3<5 扫完） | 简报 What to build / AC3 | P01a–P01e PASS | ✅ |

## 4. Preserved Data Flow Verification（设计声明不变的路线）

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| 无 where 精确语义（AC1/F7） | total=标识计数、`truncated = kept < total`、✂ 按 truncated 装配 | `lease/runtime.readMap(['tasks'],{n:2})`/`{n:5}`；✂ 字节锚由同运行全量窗读正文派生 | SA6 §6 N1/N2（HEAD 全绿） | `{n:2}`：keys=[t1,t2]、truncated=true、schema = 全量正文 + `\n✂ 截断事实：\n- tasks · 窗口 · 基 key asc · kept 2/total 5\n`（恰一空行分隔，与 #369 锚文法一致）；`{n:5}`：truncated=false、无 ✂；lease ≡ runtime（P15a–P15c/P16 PASS） | ✅ |
| present-undefined ≡ 缺席（B-12/T10） | `where: undefined` 走无 where 精确语义 + ✂ 在场 | `readMap(['tasks'],{n:2,where:undefined})` | SA6 O8（HEAD 缝 1 拒） | keys=[t1,t2]（未过滤）、truncated=true（2<5）、schema 含 ✂（P06 PASS） | ✅ |
| readData 冻结（F1/L5） | options 闭合形状 `{depth?,maxChildrenPerNode?}`，where 渗入即拒 | `runtime.readData(['tasks'],{where} as never)` | #273/#336 契约 | `ok:false, code:'READ_OPTIONS_INVALID'`（P17 PASS） | ✅ |
| 失败码族透传（F4/B-8） | 合法 where 下三码各就各位、不被 options 面吸收 | `readMap(['nope',{n:1,where}])`、`readArray(['tasks'],{n:1,where})`、`readMap(['badHit'],{n:2,where,depth:1})` | #369/#382 家族 | `WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `PATH_NOT_ALLOWED`，失败 own 键集恰 `{code,message,ok,path}`、无 value/schema/truncated（P18–P20 PASS） | ✅ |
| 公共面冻结（F3/L4） | runtime 十四键 / lease 十五键 / 值导出面零新增 | `registry-surface.test.ts` + `runtime-close-lifecycle.test.ts` + 形状收敛门实跑 | SA3 自报 46 用例绿 | 本机实跑 3 files / 46 tests passed、Type Errors no errors | ✅ |
| 既有家族零改红（M1/M7） | #369 ×2 + #382 ×2（129 用例）零改动继续绿 | 聚焦 6 文件实跑 ×2（探针删除前后） | SA6 §4 基线 129 绿 | 两次均 6 files / 199 tests passed（129 既有 + 70 新增）；#382 条件不变式绿 | ✅ |
| doc-runtime W1 零改动（F9） | `packages/doc-runtime/src/**` 零 diff | `git diff --stat -- packages/doc-runtime/src` | SA8/SA4 静态核对 | 本机实测 diff 为空（§9 命令记录） | ✅ |
| registry src 零改动（F10） | released 短路 + raw 直传 + 别名链不动 | `git diff --stat -- packages/namespace-registry/src` + P02/P23 行为证据 | SA8/SA4 静态核对 | diff 为空；透传与 released 短路行为证据见 §5 | ✅ |
| 文档面 grep 门（A6/F-383-S2-1） | `kept < total` 文档陈述（排除 wiki//adr//CONTEXT）全部带 where 限定 | 全仓 `grep -rn "kept < total" --include="*.md"` | SA3 自报恰 4 处 | 本机实测恰 4 处：`typed-access.md` L172（"Without `where`" 限定）、根 `AGENTS.md` L31（"without `where`" + 双语义句）、`cordis-plugin-hosting.md` L413/L418（「无 where =」/「where 缺席形态」）——全部限定 | ✅ |

## 5. State Machine Verification（close/release 生命周期）

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| runtime ready | `close()` 已结算后带 where 读 | 停接纳 `RUNTIME_READ_DISABLED`；own 键集恰 `{code,message,ok,path}`；lifecycle gate 先于 options（零 options 触达） | P21：码/键集符合；trapCounting options **touches=0** | 无「close 后仍成功/仍读 doc」；无 options 先行读取 | ✅ |
| runtime ready | `close()` promise 在途（closing 期）同步读 | 同款四键停接纳（closing 即停接纳） | P22：`RUNTIME_READ_DISABLED`（close() 同步段置 closing，读取在 promise 结算前发出） | 无 closing 期 ready 结果外泄（竞态） | ✅ |
| runtime closed | 重复 `close()` + 重复读 | 幂等：同一 promise 实例；重复读结果逐字节稳定 | P21b：`close()` 返回同一实例；两次读 deep-equal 相等 | 无状态回退/复活 | ✅ |
| lease active | `release()` 后带 where 读（readMap + readArray） | released 短路先于透传：`NAMESPACE_LEASE_RELEASED`、own 键集恰 `{code,message,ok}`、零 options 触达 | P23：两方法同码、键集三键、touches=0 | 无「released 后落到 runtime 层成功/失败」 | ✅ |
| 敌意 options 视图 | Z8 交替视图（①合法 where / ②accessor 项 / ③合法） | 出口②接缝终态 `WINDOW_OPTIONS_INVALID`（W1 重派发竟又接受 ⟹ 终态响亮拒绝） | P14：`ok:false` 同码、四键失败形、恰 3 次校验 pass、accessor 零执行、零外抛 | 无 `ok:true` 静默通过；无外抛；无第五键 | ✅ |
| 敌意 options 视图 | Z1/Z2 throwing `get` trap（descriptor 诚实） | 全链零 `[[Get]]`：成功且 trap 零命中 | P12/P13：`ok:true`、条目=预言机、getCalls=0 | 无 get trap 触发/外抛 | ✅ |

## 6. Error and Cleanup Flow

- **失败传播**：合法 `where` 下 `WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `PATH_NOT_ALLOWED` 各就各位（P18–P20），失败 own 键集恰四键、无半窗（无 `value`/`schema`/`truncated` 键）——W1 失败不被 options 面吸收。
- **零外抛**：Z1/Z2（throwing get trap）、Z8（accessor 项 + 状态化视图）全部同步收编，探针无任何 escape（P12/P13/P14）。
- **cleanup 到 quiescence**：探针内所有 runtime `close()`、所有 registry `shutdown()`/lease `release()` 均显式到达；探针为一次性脚本，无后台服务/端口/PID 文件残留；heavy 读后 `rtHeavy.close()` 到位。
- **restart/复活**：close 后重复读、重复 close、release 后读——旧路径（成功面）未复活（P21/P21b/P23）。

## 7. Scale and timing（SA4 §10 项 3）

`bigTasks`（2000 条/3 claimed）`{n:5}`+`{n:3}` 与 `poisonScored`（2000 条/2 claimed/未匹配埋 NaN）`{n:2,depth:1}` 三次 heavy 读合计 **3 ms**（P25d），秒级门槛富余；全仓 `pnpm test`（maxWorkers:1）597 s，与基线 609 s 同量级，无拖垮。

## 8. Temporary Diagnostics

| 临时物 | 位置 | 处置 |
|---|---|---|
| 行为探针 `__sa7_383_probe.mts`（38 检查点；schema/doc 自建、期望独立预言机派生） | `packages/namespace-registry/test/` | 证据捕获（`/tmp/sa7-383-probe.out`，非仓内）后 `rm` 删除 |
| P15b 诊断脚本（一次性） | 同上（`__sa7_p15b_diag.mts`） | 运行后即 `rm`；输出仅入本报告引述 |
| 生产代码 `[SA7-DATAFLOW]` 日志 | — | **零添加**（探针为黑盒公共面取证，无需插桩）；`git diff \| grep SA7-DATAFLOW` = 0 命中 |
| 删除后复核 | — | 聚焦 6 文件 + 2 test-d 复跑：**8 files / 205 tests passed、Type Errors no errors**——与删除前（199）+ typecheck 段（6）一致，关键场景结果不变 |

`git status --porcelain` 收尾复核：仅实现 diff（6 modified + 5 新测试/fixture）+ wiki 产物；无探针/诊断残留（目录内 `*sa7*` 命中均为早前 issue 的既有跟踪测试文件，非本轮产物）。

## 9. Commands and Evidence

| # | 命令（cwd=worktree） | 结果 |
|---|---|---|
| C1 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck <SA6 §14 四文件 + #383 两 .test.ts>` | 6 files / 199 tests passed、Type Errors no errors、2.39s、exit 0（探针删除前后各一次，结果一致） |
| C2 | 探针：`NODE_OPTIONS=--conditions=nomicore-source ./node_modules/.bin/tsx packages/namespace-registry/test/__sa7_383_probe.mts` | **SUMMARY passed=38 failed=0、exit 0**（`/tmp/sa7-383-probe.out`；首轮 37/38——唯一 FAIL 为探针 ✂ 字节锚预言机自构错（正文尾 `\n` 重复计数），诊断脚本证实实现为「恰一空行分隔」与 #369 冻结文法一致后修正预言机，复跑全绿；实现零改动） |
| C3 | 同 C1 + 两个 `.test-d.ts`（P4/P5） | 8 files / 205 tests passed、Type Errors no errors、3.00s、exit 0（删除后关键场景复跑） |
| C4 | `pnpm typecheck` | **exit 0**（14 个 tsc 工程） |
| C5 | `pnpm test`（全仓门 AC8） | **exit 0**：Test Files **400 passed (400)** / Tests **4903 passed (4903)** / Type Errors no errors / 597.07s——与 SA3 自报逐位一致；基线 396/4827 + 4 新文件 + 76 用例对账成立（新文件被真实采集） |
| C6 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck registry-surface.test.ts runtime-close-lifecycle.test.ts readdata-shape-assertion-consolidation-gate.test.ts` | 3 files / 46 tests passed、Type Errors no errors（十四/十五键与形状收敛冻结面保持） |
| C7 | `git diff --stat -- packages/doc-runtime/src` / `-- packages/namespace-registry/src` / `-- packages/namespace-runtime/src/index.ts` | 均为空（F9/F10/导出面冻结实测） |
| C8 | `grep -rn "kept < total" --include="*.md" .`（排除 wiki//adr//CONTEXT） | 恰 4 处且全部带 where 限定（§4 末行） |
| C9 | `git diff \| grep -c SA7-DATAFLOW` | 0 |

## 10. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA4 §10-1 | SA3 自报运行证据需独立复跑 | C1/C3/C4/C5/C6 | 全绿 + 400/4903 口径 | 与自报逐位一致 | C1–C6 | ✅ | 无 |
| SA4 §10-2 | S1 交替视图（视图②隐藏 where）运行时行为 | 探针 P11 | ok:true、[t1,t3]、truncated=true、无 ✂、恰 2 pass | 全符合（passes=2, getCalls=0） | C2 | ✅ | 无 |
| SA4 §10-3 | 规模用例时序 | 探针 P25 | 秒级、无超时 | 3 ms | C2 | ✅ | 无 |
| SA4 §10-4 | close/release 期读时序稳定性（closing 在途读） | 探针 P21–P23 | 稳定停接纳/释放码 | 四键/三键失败形稳定、零 options 触达 | C2 | ✅ | 无 |
| Design §9 跳 3–5 | 五跳数据流 + total 单源 | 探针 P01–P09 | 过滤四键 + 双语义 + ✂ 永不装配 + 透传 | 全符合 | C2 | ✅ | 无 |
| SA6 §12.3（AC2/AC5） | 装满判定边界、敌意零外抛、Z8 两出口 | 探针 P04/P12–P14 | 恰 n 亦 true；getCalls=0；出口②响亮 | 全符合 | C2 | ✅ | 无 |
| SA6 §12.3（AC1/AC7） | 无 where 零漂移、生命周期覆盖 | C1/C2/C3/C6 | 字节锚 + 停接纳 | 全符合 | C1–C3/C6 | ✅ | 无 |
| SA8 A-I1 ① | 装满判定消费 S3 canonical `n`（双合法视图值漂移为已接受暴露类） | 探针 P11（canonical n=2 来自 S3 视图） | 结算取 S3 视图 n，不重读 W1 | truncated=(2===2)=true | C2 | ✅（与 Z 组头注登记一致） | 无 |
| SA8 A-I1 ② | SA3 对 SA6 A3/A4 两处 fixture 事实偏差 | C1（A 组用例绿）+ 探针 P15b 独立字节锚 | 语义面与 ADR/CONTEXT 一致 | ✂ 锚、taskList total=3（原生 length）均实测符合 | C2 诊断 + C1 | ✅ | 无 |
| SA4 §11-1/2/3（MINOR） | T4 序断言形态 / lease 清理不对称 / Z8 message 子串 | 静读 + C1/C2 复核 | 不阻断验收 | T4 承重断言（truncated）精确；release-only 清理与 #369 先例同款且无真实定时器；探针以行为（passes=3/accessorCalls=0）不依赖 message 复核出口归属 | C1/C2 | ✅（维持不阻断） | 无 |

## 11. Deviations

- **探针预言机自构错一次（非实现偏差）**：首轮 P15b 以「正文 + `\n\n` + ✂ 块」构造期望，重复计入正文尾随 `\n`。一次性诊断脚本（同法构造、打印实值尾部）证实实现为「正文（尾随单 `\n`）+ `\n` + ✂ 块」——即恰一空行分隔 `\n\n✂ 截断事实：`，与 #369 冻结文法（`FACTS_*` 字节锚、测试头注「以恰 1 空行分隔」）一致；修正探针预言机（实现零改动）后复跑 38/38 绿。登记为探针侧偏差，实现无涉。
- 无其他偏差：实现行为与设计 §5.1–§5.6/§9、SA6 契约 B-1–B-15、AC1–AC8 逐项吻合；未发现 SA4 之外的任何 fail 事实。

## 12. Verdict

**`approve`**

理由：① 设计声明改变的路线（S3 五键镜像、S6 双语义、✂ 有 where 永不装配、lease 透传 where）在活链路上逐跳按设计变化——38 项独立探针检查全绿，关键中间值（W1 `total` 双形态、canonical `n`、装满判定、✂ 装配分支、条目身份、逐条目 depth 等价、毒埋零重物化）均有运行时证据；② 设计声明不变的路线（无 where 精确语义 + ✂ 字节锚、readData 冻结、失败码族、十四/十五键公共面、doc-runtime/registry src 零 diff、#369/#382 家族、文档 grep 门）逐项保持；③ 状态机（closing/closed/released、幂等 close、重复读稳定、敌意视图两出口）转换与关键值正确、禁止转换未出现；④ 错误传播与清理符合设计、到达 quiescence；⑤ SA3 自报运行证据经独立复跑逐位确认（199 聚焦 + 400 files/4903 tests + typecheck exit 0）；⑥ 临时诊断已删除、删除后关键场景复跑结果不变、`git diff` 无 `[SA7-DATAFLOW]` 残留。

SA4 verdict 为 approve，本验证未发现任何可致 reject 的新事实；SA7 在其基础上维持 **approve**。
