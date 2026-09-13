# SA7 数据流与状态机动态验证报告 — issue #369 W2：lease 公共面 `readArray` / `readMap`（ADR 0028）

- 被验对象：SA3 W2 实现（iteration 1，F-369-1 返工后）——worktree
  `/home/wangjian/nomicore-fix-issue-369`，branch `mabf/issue-369`，HEAD `ab6e390` 上的
  工作区 diff（22 tracked 修改 + 5 个新代码/测试文件：`window-read.ts` + 两契约测试 +
  fixture + `.test-d.ts`）。SA4 verdict = **approve**（iteration 1；本报告在其基础上独立
  动态验证，未发现任何 fail，故不下调）。
- 验证方式：活链路动态验证——真实 Registry 装配（`createNamespaceRegistryForTesting` +
  生产 runtimeFactory）+ 真实 runtime（`createNamespaceRuntimeWithSeam`）；既有契约测试
  全量复跑 + 临时动态探针（7 场景，运行后已删除）；root 全量套件与类型面证据。
  零生产代码改动（dispatch 约束）。

## 1. Inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-369.md`（Host brief） | 在场 | AC1–AC6；评论数 0（无 owner 条款） |
| `wiki/raw/task_issue-369_design.md`（SA1 冻结设计，F-1 修订版） | 在场 | §7.1 B-1–B-11、§7.2 B-6、§7.3 S1–S6、§7.4、§8.2 数据流、§9 失败面、§13 残余 |
| `wiki/raw/task_issue-369_sa6_contract.md`（approve 附冻结条件） | 在场 | §12.1–§12.8 验收契约（SA7 动态验收基线） |
| `wiki/raw/task_issue-369_sa2_review.md`（approve） | 在场 | F-1 敌意 field 呈现安全验收标准 |
| `wiki/raw/task_issue-369_design_conflict_report.md`（SA8，clear） | 在场 | 协议边界识别（RA-1–RA-5 实现期义务兑现核对） |
| `wiki/raw/task_issue-369_sa3_impl.md` / `task_issue-369_sa4_review.md` | 在场 | 被验变更清单 + SA4 §11 点名的 SA7 动态验证项 |
| 交付实现与测试（`window-read.ts` 742 行、`runtime.ts`/`lease.ts`/`types.ts`/两 `index.ts`/`read-schema-projection.ts`、3 契约文件 + fixture） | 已读 | 跳点对照（读实现后跑动态） |

SA4 §11 点名交 SA7 的动态项：① root `pnpm test` 全量；② `{}` 预算 ≡ 无预算渲染逐字节；
③（可选）敌意 path readMap 面变体。三项全部执行（见 §3/§9）。

## 2. Runtime environment

| 项 | 值 |
|---|---|
| OS / Node / pnpm / vitest | Linux；`v24.13.0`；`10.28.2`；`3.2.7` |
| 装配 | 依赖已装（SA6 轮 `pnpm install --frozen-lockfile` 后 Store 复用；本轮零安装变更） |
| 服务/进程 | 零服务、零端口、零后台残留（全同步内存装配；唯一后台 job = 全量套件，已结算 exit 0） |
| 证据日志 | `artifacts/sa7-issue369-{contract-focused,typecheck-only,full-suite,probe}.log` |

## 3. Changed Data Flow Verification（设计 §8.2 声明的四条新路线）

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| 窗口值通道 | lease→runtime→W1 直通，恒四键、条目身份随行、失败原样透传 | 探针 P1（真实 Registry 装配，生产 runtimeFactory）：`lease.readArray(['workRecords'],{n:2,orderBy:{by:'index',dir:'desc'},depth:1})` / `lease.readMap(['tasks'],{n:2,orderBy:{field:'priority',dir:'desc'},depth:1})` | lease（15 键面，`readArray`/`readMap` 在场）→ runtime（14 键面）→ W1 → 四键结算 | 恰四 own 键；`value=[{index:0,value:30},{index:2,value:20}]` / `[{key:'t2',…9},{key:'t3',…5}]`；`truncated:true` | 实测逐字段一致（P1 日志：keys `[ok,schema,truncated,value]`、值/schema/truncated 全符）；lease ≡ runtime `toStrictEqual`（同装配双调） | ✅ |
| total 计数 | S4 组合层 O(N) 标识枚举、与 W1 候选空间逐位一致、零值域读 | 契约 T1/T7（独立预言机对账：Y.Map `undefined` 值键/accessor/non-enumerable/稀疏数组/ROOT 面）+ E3（N=2000 毒值）+ 探针 P2 活变异 | W1 成功后 `countWindowCandidatesAtPath` → `total` 进 ✂ 事实行与 `truncated` | `truncated === kept < 预言机 total`；E3 `ok:true` kept 2/total 2000（全量物化实现必红） | 契约 50/50 绿（含 E3、T7 全边界矩阵）；P2 活观察：doc push 后 `kept 2/total 3` → `kept 2/total 4`（事实随 doc 瞬时状态刷新、零缓存） | ✅ |
| 元素口径 schema | S5 锚链（数组 `[...p,0]` 单锚；键面 `'<key>'`→容器回退）+ 渲染器正文，路径键控与数据无关 | 契约 S1–S4/A3/A6 + 探针 P2（双侧剥离对账：窗口侧去 ✂ 窗口块 vs `readData(锚,同预算)` 侧去头行与其自身 ✂ 段） | 快照 → `anchorSchemaBody` → `projectSchemaTextBody`（状态守卫→normalize→resolver→渲染器正文） | 正文 + `‡` 页脚逐字节相等；空容器照常元素口径；封闭对象容器口径（depth 自容器起算，R1 已知限制如实呈现） | 数组/taskList/Record（普通+keyPattern+空）/封闭对象 × depth{0,1} 全部逐字节相等；空容器 `value:[]` + 元素口径 + 无 ✂；`meta` depth:0 呈 `[...]‡` | ✅ |
| ✂ 窗口事实 | S6 B-8 四插值槽确定性渲染、块恒头行 + 恰一行事实行、kept<total 才在场 | 契约 T1–T7（Byte 级常量）+ 探针 P2/P6/P7 | `truncated ∧ 正文非 null ∧ 快照在场` → `appendWindowFacts`（剥尾 `\n` + `\n\n` + 块 + 恰一 `\n`） | `- <path> · 窗口 · 基 <basis> <dir> · kept n/total N`；total=0 / kept===total 无 ✂ | Byte 级 `endsWith('\n\n✂ 截断事实：\n- workRecords · 窗口 · 基 index desc · kept 2/total 3\n')` 等全符；T2/T3 无 ✂；P2 活变异后事实行更新为 `kept 2/total 4` | ✅ |

关键中间跳点均获运行时证据（非仅终值）：lease 键面 13→15 / runtime 12→14（P1 实测键集）；
canonical 归一化基进 ✂ 行（T4/A4 基×方向矩阵）；单快照纪律（见 §6 敌意 path）。

## 4. Preserved Data Flow Verification（设计声明不变的路线）

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| readData 冻结面 | 恒四键 + 头行 + 渲染正文 + 自身 ✂ 段；窗口事实不写进 readData 文本 | NC1 + readData 字节锚测试（全量套件内） | SA6 基线 388 文件/4668 用例全绿 | NC1 绿：`# readData [tasks]` 头行在场、`窗口` token 不在场、`truncated:false`；全量 391 文件/4722 用例中全部 readData 快照/字节锚绿 | ✅ |
| readData canonical 等价面 | `{}` 预算 ≡ 无预算渲染逐字节（SA4 §11 转动态项） | 探针 P3：`readData(锚,{})` vs `readData(锚)` 8 锚点（`[]`、workRecords、workRecords.0、taskList.0、tasks、`tasks.<key>`、meta、emptyTags） | SA3 探针断言（实现期） | 8/8 锚点 schema **逐字节相同**（含头行同形、value/truncated 同）；P3 日志逐锚点 `equal:true` | ✅ |
| W1 冻结面（#368） | 成功恰两键、三码 + `PATH_NOT_ALLOWED`、D3/D6 语义；doc-runtime 零 diff | NC2 + F1/F2/E4（与直调 W1 `toStrictEqual`）+ `git diff --stat HEAD -- packages/doc-runtime` | SA6 基线（#368 契约全绿） | doc-runtime/vfsl/CONTEXT.md/docs-adr/vitest.config/replication-protocol **零 diff**（git 实查 0 条目）；F1 三码逐字、F2/E4 fail-fast 无半窗均绿 | ✅ |
| lease released 通道 | released 短路先于一切透传、冻结 issue 原样、readData 通道同形 | F3 + 探针 P5 | SA6 NC3（探针） | P5：release 后两窗口方法返回**同一冻结对象**（`r1 === r2`，键集 `[code,message,ok]`、`NAMESPACE_LEASE_RELEASED`）；`readData` 同 code；重复 release 幂等 | ✅ |
| runtime lifecycle 通道 | lifecycle≠ready → `RUNTIME_READ_DISABLED`（零 options 读取、零 doc 触碰、path 回显）；getStatus 全程可观察 | F4 + 探针 P4（真实 runtime，非替身） | readData 同门先例（#336 B-1） | P4：ready 读成功 → `await close()` → `closed`；两窗口方法同步返回 `RUNTIME_READ_DISABLED` 四键失败形 + path 回显（`['workRecords']`/`['tasks']`）；**敌意 options（`get n()` throw）零触发**（gate 先于 options 读取的动态证明——无外抛即无属性读）；close 幂等；getStatus 仍可观察；readData 同门 | ✅ |
| 缺席语义对偶 | readData 缺席吸收（`ok:true`）vs 窗口响亮（`WINDOW_TARGET_ABSENT`）互不污染 | NC4 | SA6 §9-5 | NC4 绿：`readData(['nope'])` ok:true+undefined；`readArray(['nope'],{n:1})` → `WINDOW_TARGET_ABSENT` | ✅ |
| 键集守卫/值导出面 | runtime 12→14、lease 13→15，既有键全保留；值导出面不变 | 四守卫测试 + exports-audit（全量套件内）+ 探针 P1 键集实测 | SA6 基线 12/13 键 | 守卫绿；P1 实测 14/15 键且既有 12/13 键全数在场 | ✅ |

## 5. State Machine Verification

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| runtime `lifecycle='ready'`（schema ready） | 窗口读 | 同步纯读、零状态写入、幂等（同 doc 状态同结果） | P4 ready 读四键成功；契约 S3 两次调用 `toStrictEqual` | 读路径不写状态/不进 sequencer（全同步、无异步槽交错面）——未见任何状态漂移 | ✅ |
| runtime `ready` | `close()` | ready→closed（停接纳；drain；幂等） | P4：close 后 `getStatus().lifecycle='closed'`；二次 close 无异常；getStatus 仍可观察 | close 后读成功（复活）未出现——两窗口方法 + readData 均 `RUNTIME_READ_DISABLED` | ✅ |
| runtime `closed` | 窗口读（敌意 options） | gate 先行拒绝，零 options 读取、零 doc 触碰 | P4：`get n(){throw}` 的 options 下同步返回 disabled，无外抛（属性读零发生） | options 读取泄漏 / doc 触碰未出现 | ✅ |
| lease `active` | `release()` | active→released；冻结 issue 单例；幂等；release 不追踪已接纳操作 | P5：release 后 `getStatus().lease='released'`；`readArray`/`readMap` 返回同一冻结对象；再 release 幂等 | released 后透传 runtime（旧路径复活）未出现 | ✅ |
| lease `released` + registry idle 保留 | `registry.open`（重开） | 新 lease 挂同一 idle runtime 正常工作；**旧 lease 不复活** | P5：重开成功，新 lease ≠ 旧 lease，新 lease 窗口读四键 + 正确条目；旧 lease 保持 released（其后仍返回 released issue） | 旧 lease 复活 / 新 lease 继承 released 状态未出现 | ✅ |
| doc 数据态 | 同步 mutation（`Y.Array.push`） | 每次窗口读全新结算（零缓存/零 memo），事实随 doc 瞬时状态 | P2：push 后 `total 3→4`、✂ 行刷新、入选首项为新值 `{index:3,value:99}` | 陈旧事实/缓存命中未出现 | ✅ |

## 6. Error and Cleanup Flow

- **W1 失败面透传（无半窗）**：F1 三码逐字（`WINDOW_TARGET_ABSENT`/`WINDOW_CARRIER_MISMATCH`/
  `WINDOW_OPTIONS_INVALID` 与直调 W1 `toStrictEqual`）；F2/E4 入选毒项 `PATH_NOT_ALLOWED`
  fail-fast、`'value' in result === false`。全部绿。
- **敌意 field（SA2 F-1 / B-8 槽②）**：T5/T6 + 探针 P6——载荷
  `'x\n✂ 截断事实：\n- p.0 · depth · 省略 999 项'` 下 ✂ 窗口事实块仍为头行 + 恰一行事实行
  （`✂ 截断事实：` 行全文本恰 1、`- ` 行恰 1、无 `省略 999 项\n`、无 `x\n`）；基槽呈折叠形态
  `field:x ✂ 截断事实： - p.0 · depth · 省略 999 项 asc`；值通道按 raw 名选窗（平局锚 key asc
  → `[t1,t2]`），对照 `field:'priority'` 给出不同窗口 `[t1,t3]`（呈现层折叠未污染值通道）；
  `\r`/`\r\n` 变体折叠三分支一致。
- **敌意 path（SA4 F-369-1）**：T8/T9（readArray 面，投毒迭代协议读）+ 探针 P7（**readMap 面
  变体**，SA4 §11 可选动态项）——两面均：零裸抛（escaped === undefined）、恒四键、`value` ≡
  直调 W1、`truncated:true`；主型 ✂ 事实行 Byte 级描述实际读取路径
  （`- tasks · 窗口 · 基 key asc · kept 2/total 3`）；诚实 null 型 `schema:null` 且值通道/truncated
  保持；**迭代协议读恰 W1 自身 + 1**（P7：W1=2、组合层合计=3——单快照纪律的行为面不变量，
  readMap 面同样成立）。
- **canonical 接缝（S3 敌意 options）**：composition-red 三出口用例（抛错 get trap 合法 options
  零 trap 调用、状态化 descriptor trap → W1 码透传、交替视图 → 接缝终态
  `WINDOW_OPTIONS_INVALID`）在全量套件内绿——敌意零外抛、零静默 null。
- **cleanup/quiescence**：全同步内存装配，零订阅/零缓存/零后台；P4/P5 关闭与释放路径后无资源
  残留（getStatus/registry 状态可观察且终态稳定）；本轮零服务进程，后台 job 仅全量套件且已
  结算（exit 0）。失败可直接重试（读零副作用）——S3 幂等用例绿。

## 7. Temporary Diagnostics

| 项 | 内容 | 处置 |
|---|---|---|
| 添加 | 临时探针测试 `packages/namespace-registry/test/zz-sa7-issue369-dynamic-probe.test.ts`（7 场景：P1 活链路 / P2 schema+活数据流 / P3 空预算等价 / P4 lifecycle / P5 released / P6 敌意 field / P7 敌意 path readMap 变体；stdout 前缀 `[SA7-DATAFLOW]`，仅 route/step/关键值） | **已删除**（`git status` 实查该路径零命中；工作区未跟踪新文件仅剩交付的 5 个代码/测试文件） |
| 证据 | 观察值经 `artifacts/sa7-issue369-probe.log` 留档（仅日志，无可执行源码） | 保留为证据日志（不入 artifactPaths；仓内 SA6 先例同款） |
| post-removal 验证 | 删除探针后工作区 = 交付 diff 原状；root `pnpm test`（391 文件）在全量收集时**不含**探针文件（探针创建晚于套件启动且 run 模式不增量收集）→ 全绿即无探针状态下的复跑证据；另 02:14 焦点契约运行亦为探针前运行 | 结果不变（全绿） |
| `[SA7-DATAFLOW]` 残留 | `git diff HEAD | grep -c SA7-DATAFLOW` = **0**；`git diff --check` clean | ✅ |

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA6 AC1（恒四键/条目/空容器） | 能力存在性 + 四键恒形 | 契约 A1–A6 + 探针 P1 | 恰四键、身份随行、空容器 `[]`+元素口径+无 ✂ | 全符 | `sa7-issue369-contract-focused.log` / `-probe.log` P1 | ✅ | — |
| SA6 AC2（schema ≡ 渲染器元素口径） | oracle 不漂移（渲染器与组合层） | 契约 S1–S5 + 探针 P2 双侧剥离 | 逐字节相等（含封闭对象容器口径、空/满相等） | 全符 | 同上 P2 | ✅ | — |
| SA6 AC3（✂ 事实 + truncated 一致） | kept/total/基/方向 + 预言机对账 | 契约 T1–T7 + 探针 P2/P6 | `truncated===kept<total`；✂ 单行；total=0 无 ✂ | 全符 | 同上 | ✅ | — |
| SA6 AC4（组合式 depth 等价 + 零物化） | 入选项 ≡ 同预算 readData；N=2000 哨兵 | 契约 E1–E4 | 逐项 `toStrictEqual`；E3 `ok:true` kept 2/total 2000 | 全符 | 契约运行绿 | ✅ | — |
| SA6 AC5（失败面透传 + 类型别名） | 三码透传、released/lifecycle、raw 引用 | 契约 F1–F6 + Y1 + 探针 P4/P5 | 形状语义逐字不变 | 全符 | 契约 + `sa7-issue369-typecheck-only.log`（231 用例 no errors） | ✅ | — |
| SA6 AC6（文档/负控/全绿） | root typecheck/test 全绿 | `pnpm typecheck` + `pnpm test` | exit 0；Type Errors: no errors | typecheck exit 0；**391 文件/4722 用例全绿**（基线 388/4668 → +3 文件/+54 用例 = 交付三测试文件） | `sa7-issue369-full-suite.log` | ✅ | — |
| SA4 §11-1（全量套件） | SA3 未跑的 root 全量 | 同上 | 全绿 | 全绿 | 同上 | ✅ | — |
| SA4 §11-2（`{}` ≡ 无预算逐字节） | canonical 空轴走 budgeted 分支的渲染漂移风险 | 探针 P3（8 锚点） | schema 逐字节相同 | 8/8 相同（含头行同形） | `sa7-issue369-probe.log` P3 | ✅ | — |
| SA4 §11-3（敌意 path readMap 面变体） | 共用骨架的静态结论动态复核 | 探针 P7 | 零外抛、事实行/诚实 null 正确、迭代读恰 W1+1 | 全符（W1=2、合计=3） | 同上 P7 | ✅ | — |
| SA4 F-369-1（修复不回归） | 单快照纪律 + 零外抛 | 契约 T8/T9 | 红绿对成立且现绿 | 绿（50/50） | 契约运行 | ✅ | — |
| SA2 F-1（敌意 field 行注入） | ✂ 块结构不可伪造 | 契约 T5/T6 + 探针 P6 | 单行不变式 + 值通道非污染 | 全符 | 同上 | ✅ | — |
| Design B-9/§7.4（计数镜像漂移） | total ≡ W1 候选空间 | 契约 S4 矩阵 9 例 + T7 边界 + E3 | 预言机逐位一致 | 全符 | 契约运行 | ✅ | — |
| Design §12.7 红线（DENY 面） | doc-runtime/vfsl/CONTEXT/docs-adr/vitest.config 零 diff | `git diff --stat HEAD -- <DENY>` | 0 条目 | 0 条目 | git 实查（§4 表） | ✅ | — |
| Design §13 R4（`schema:null × truncated:true`） | 窗口事实仅经 schema 文本承载 | T7/T9 | null 时只剩布尔、非读失败 | 全符 | 契约运行 | ✅ | — |

无额外新 finding 需扩大验证范围。

## 9. Commands and Evidence

| # | Command | Result | Evidence |
|---|---|---|---|
| 1 | `npx vitest run packages/namespace-registry/test/issue-369-window-read-lease-contract-red.test.ts packages/namespace-runtime/test/issue-369-window-read-composition-red.test.ts --typecheck.enabled=false` | **绿**：2 files / 50 tests（33 lease 契约含 T8/T9 + 17 组合层） | `artifacts/sa7-issue369-contract-focused.log` |
| 2 | `npx vitest run --typecheck.only --passWithNoTests=false` | **绿**：38 files / 231 tests；`Type Errors: no errors` | `artifacts/sa7-issue369-typecheck-only.log` |
| 3 | `pnpm typecheck && pnpm test` | **全绿**：typecheck exit 0（14 tsconfig）；root `vitest run --typecheck` → **391 files / 4722 tests passed、Type Errors: no errors、exit 0** | `artifacts/sa7-issue369-full-suite.log` |
| 4 | 临时探针（vitest 单文件，7 场景，`[SA7-DATAFLOW]` stdout） | **7/7 绿**；观察值见 §3–§6；探针文件已删除 | `artifacts/sa7-issue369-probe.log` |
| 5 | `git diff --stat HEAD -- packages/doc-runtime packages/vfsl CONTEXT.md docs/adr vitest.config.ts packages/replication-protocol` | **0 条目**（DENY 面零触碰） | §4 表 |
| 6 | `git diff --check`；`git diff HEAD \| grep -c SA7-DATAFLOW` | clean；**0** | §7 |

## 10. Deviations

- 无阻断性偏差。两项如实登记：
  1. **P3 首跑在 `[]` 锚点红**：fixture 的 `probe.*` 原始敌意数据（accessor/稀疏数组）使
     ROOT 全量无预算 `readData([])` 响亮失败——这是 readData 对值域违规的**既有冻结语义**
     （非 W2 缺陷）；探针改用 `probe:false` fixture 后 8/8 锚点绿。零生产影响。
  2. SA4 O-1（键面容器回退锚未按 schema 形状收窄）为静态观察项，动态面表现为 off-schema
     数据下的呈现口径选择（值通道正确、无崩溃），已在 SA4 登记、不属本报告阻断范围。

## 11. Verdict

**approve** —— 交付 diff 满足批准验收契约（issue AC1–AC6 + SA6 §12 冻结契约 + SA1 设计
B-1–B-11）：

1. **Changed routes 按设计变化**：窗口值通道（lease 15 键→runtime 14 键→W1 直通→恒四键）、
   total 计数（O(N) 零物化、预言机逐位一致、活 doc 状态刷新）、元素口径 schema（锚链 +
   oracle 逐字节、封闭对象容器口径、空容器照常）、✂ 窗口事实（B-8 四槽、单行不变式、
   kept<total 才在场）——全部有活链路运行时证据。
2. **Preserved routes 不变**：readData 冻结面（含 `{}` ≡ 无预算逐字节）、W1 冻结面
   （DENY 零 diff + 直调对账）、released/lifecycle 通道（含冻结单例与 gate 先行）、
   缺席对偶、键集/值导出面。
3. **状态机正确、禁止状态未出现**：ready→closed 停接纳（含敌意 options 零触达）、
   active→released（幂等、不复活、重开新 lease 正常）、零缓存幂等。
4. **错误与清理符合设计**：失败面全部同步响亮不抛（敌意 field/path/options 三通道收编）、
   无半窗、cleanup 到 quiescence；临时诊断已删净（diff 零 `[SA7-DATAFLOW]`、`--check` clean）。
5. **全量证据**：root typecheck exit 0；root test 391 文件/4722 用例全绿 +
   `Type Errors: no errors`（SA4 §11 点名三项 SA7 动态项全部兑现）。

SA4 verdict（approve）维持；本报告未发现任何下调事由。`requiresConflictRecheck: false`
（动态验证未触及 ADR 语义面，SA8 clear / SA4 结论沿用）。
