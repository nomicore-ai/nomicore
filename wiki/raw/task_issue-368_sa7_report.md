# SA7 动态验证报告 — issue #368 W1：`@nomicore/doc-runtime` 载体级窗口原语（ADR 0028 缝 1）

- Role：SA7（Dynamic Verifier），dispatch `sa-f45fdff4-6f60-407d-9fa7-30357bde7168`，phase final-verification，iteration 0
- Worktree：`/home/wangjian/nomicore-fix-issue-368`（branch `mabf/issue-368`，基线 HEAD `36a73bb`）
- 验证焦点（dispatch）：① fail-fast `PATH_NOT_ALLOWED` 传播与无半窗泄漏；② 确定性排序含 NaN/+Infinity/-Infinity
  尾组行为；③ SA3 报告的设计钉死项（pins）观察面语义。Owner 评论 5652697060 范围 = 仅 schema 无关 W1 seam-1，
  W2（#369）/W3（#370）排除。
- 结论：**approve** —— 三焦点全部运行时证实；SA3 报告的两处 pins 观察面完成经独立动态交叉验证为**忠实的
  等价观察**（非语义分歧）；突变探针证明两承重语义（D8 fail-fast / D4 non-finite 归尾）有牙；临时诊断已清理。

## 1. Inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-368.md` | 任务简报（AC1–AC6） |
| `wiki/raw/task_issue-368_design.md`（680 行，iteration 1） | 批准设计 D1–D12、§8 数据流路线 W1-R1…R5、§9 失败语义、§11 ALLOW/DENY、§12 验证映射 |
| `wiki/raw/task_issue-368_sa6_contract.md` + `test/issue-368-window-read-contract-red.test.ts` | 验收契约（39 红 + 6 负控）与 §12.7 实现期红线 |
| `wiki/raw/task_issue-368_sa3_impl.md` | SA3 实现报告（含两处 pins 观察面完成与突变探针记录） |
| `wiki/raw/task_issue-368_sa2_review.md`、`task_issue-368_relevant_decisions.md` | SA2 F1–F4 锚定要求、ADR 0028 决策摘录 |
| `packages/doc-runtime/src/{window,index,read,carrier}.ts`、`test/*`（pins/契约/守卫） | 被验实现与测试面 |
| `packages/doc-runtime/AGENTS.md` | 公共面纪律（新导出仅经 src/index.ts；守卫逐导出记账） |

## 2. Runtime environment

| 项 | 值 |
|---|---|
| 环境 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；typescript `5.9.3`（与 SA6/SA3 同环境） |
| 实现指纹 | `window.ts` sha256 `7c765939dd4b0b75c4c3ed7559a19b38f2db1930b2d1fa0054a7c2482995a364` —— 与 SA3 报告的突变还原后哈希**逐字节一致**（SA7 启动时实现未被再改动） |
| 驱动 | 既有套件（契约 45 + pins 11 + 守卫）+ SA7 临时探针测试文件（17 场景，`[SA7-DATAFLOW]` 观察日志，已删除）+ 2 枚突变探针（临时改 `window.ts` 后 sha256 还原） |

## 3. Changed Data Flow Verification

（设计 §8.2 五条路线；Runtime driver = 契约/pins 套件 + SA7 探针 A1–A7/B1–B5b/C1–C3）

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| W1-R1 options 控制流 | 敌意 options 封闭校验、零 doc 触碰、零 accessor 执行、零外抛 → `WINDOW_OPTIONS_INVALID` | 契约 G3–G7（45/45 绿）；SA7-A5 计数 getter 探针 | accessorRuns=0、code=`WINDOW_OPTIONS_INVALID`、不抛 | 非法即拒、零副作用 | 一致（`accessorRuns:0`） | ✅ |
| W1-R2 目标解析 | G0→OPT→N0→N1 定序；缺席改判响亮 `WINDOW_TARGET_ABSENT`；detached → `PATH_NOT_ALLOWED` | SA7-A6 阶段优先级探针；pins P5/P6a；契约 G1/G2 | 非数组 path + 非法 options → `PATH_NOT_ALLOWED`（G0 先于 OPT）；非法 options + 缺席 path → `WINDOW_OPTIONS_INVALID`（OPT 先于 N1）；`['missing']` → `WINDOW_TARGET_ABSENT` | 分级定序、缺席不吸收 | `g0:PATH_NOT_ALLOWED / opt:WINDOW_OPTIONS_INVALID / nav:WINDOW_TARGET_ABSENT` | ✅ |
| W1-R3 选窗（枚举/分类/排序） | O(N) 原始键分类（`Number.isFinite` 门）+ 全序排序 + 未入选子树零读取 | pins P2/P2b/P8；SA7-B1–B4b/B5、C1/C1b/C2 | 见 §4/§5（NaN/±Inf 全落尾组、组位/锚两方向恒定、插入序无关） | 同一数据同一窗口 | 一致 | ✅ |
| W1-R4 入选项物化 | 每项 ≡ 姊妹同预算逐项读；任一项失败 → `PATH_NOT_ALLOWED` 透传 fail-fast、无半窗、无跳项、无补位 | pins P1/P6b；SA7-A1/A2/A3/A7、B5、C1/C3；契约 E1–E5 | `path:['field','f3']` 精确到项、失败联合无 `value`、n:2 前缀恰 `[f1,f2]`（不补位）、失败身份 = 有序基首个失败项（非插入序） | fail-fast 无部分结果泄漏 | 一致（A3：插入序 g3 在前，仍报 `['field','g2']`） | ✅ |
| W1-R5 结果装配 | 成功恰两键 `{ok,value}`；条目字面量构造；失败恰四键 | pins P7；SA7-A1（结算形状） | 成功 own 键集 `['ok','value']`；失败 `['code','ok','path','message']` | 恰两键/四键 | 一致 | ✅ |

## 4. 焦点一：fail-fast `PATH_NOT_ALLOWED` 传播（无半窗泄漏）

| 场景 | 驱动 | 观察结果 | 结论 |
|---|---|---|---|
| P1 fixture `n:3` 全选含毒项 f3 | pins P1 + SA7-A1（重复 3 次） | 同步不抛；`ok:false`；`code==='PATH_NOT_ALLOWED'` 严格；**失败联合无 `value` 键**（无半窗）；`path` 深等 `['field','f3']`；message 非空（实测透传姊妹原文 `non-finite number（目标.bad）`，非回退文本）；3 次调用 JSON 逐字节一致 | ✅ |
| 前缀纪律（毒项出窗即成功） | SA7-A2 `n:2` | `ok:true`，恰 `[{key:'f1',value:{s:1}},{key:'f2',value:{s:2}}]`——无补位、无错位 | ✅ |
| 首败即败（有序基序，非插入序） | SA7-A3（g3 毒且插入在首，g2 毒居序 2） | `depth:0` 序 `[g1,g2,g3,g4]`；`n:4` 失败 `path=['field','g2']`（有序基首个失败项） | ✅ |
| 失败身份 n 不变性 | SA7-C1（n=4…9） | 全部报 `['tasks','q1']`——fail-fast 恒停在有序基首个失败项，尾组其余项不可经 legacy 观察（观察面缺口的运行动因，见 §6） | ✅ |
| 数组面同通道（detached 项） | pins P6b + SA7-B5 | plain array 内 detached Y.Map / NaN 项入选 → `PATH_NOT_ALLOWED`、`path` 精确到项（`['arr',0]` / `['arr',1]`） | ✅ |
| **突变 A（静默跳项）** | 临时改 `window.ts`（`continue` 跳失败项） | pins **5 红**（P1/P2/P2b/P6b/P7）+ SA7 探针 **6 红**；**契约 45 用例仍全绿**——实证 SA2-F1 伪绿通道（契约只对已返回条目对账，被跳条目不可见），pins/探针封堵有效 | ✅ 有牙 |
| 突变还原 | sha256 复测 | `7c765939…364` 与实现原哈希逐字节一致 | ✅ |

## 5. 焦点二：确定性排序（NaN/+Infinity/-Infinity 尾组）

| 场景 | 驱动 | 观察结果 | 结论 |
|---|---|---|---|
| field 基全序（插入序打乱 `q5,q3,q1,s1,n2,q2,q4,n1`） | pins P2 + SA7-B1（`depth:0`） | asc `[n1,n2,s1,q1,q2,q3,q4,q5]`；desc `[n2,n1,s1,q1,q2,q3,q4,q5]`——组间序/尾组位两方向恒定、组内键 asc 恒定、NaN/-Inf/+Inf 全落尾组；n=5 边界两方向第 4/5 位均 `q1,q2` | ✅ |
| 数组面值键归尾 | pins P2b + SA7-B4/B4b | asc n:3 = `[2,0,5]`、desc = `[0,2,5]`；尾组首项两方向恒下标 1（`['arr',1]` fail-fast 身份，n=4/6 不变）；null 孪生 doc（可物化同组 2 分类）全序列 `[2,0,5,1,3,4]` / `[0,2,5,1,3,4]` ok:true 直测 | ✅ |
| 插入序无关 + 孪生 doc 确定性 | SA7-B2（3 种插入排列） | 三排列 asc/desc/n=5 窗口 JSON 逐字节一致（不依赖 Y.Map 插入序） | ✅ |
| 重复调用确定性 | SA7-B3（5 次） | distinct JSON = 1 | ✅ |
| 码点身份锚（astral 平局） | pins P8 | 两方向均 `['\uFFFD','\u{1F600}']`（码点序，非 UTF-16 码元序） | ✅ |
| **突变 B（non-finite 归 number 组）** | 临时改 `classifySortKey` 去掉 `Number.isFinite` 门 | pins **2 红**（P2/P2b）+ SA7 探针 **8 红**（B1/B2/B4/B5/C1/C1b/C2/C3）；契约仍绿（契约对排序键 non-finite 零断言，SA6 §15-2 刻意） | ✅ 有牙 |
| 突变还原 | sha256 复测 | 与原哈希一致；`grep "SA7 MUTATION"` 零残留 | ✅ |

## 6. 焦点三：设计钉死项（pins）观察面语义（SA3 报告的两处完成）

SA3 报告 P2 以 `depth:0`、P2b 以「可物化前缀 + 尾组首项 fail-fast 身份」观察，理由是 D12 原始期望不可作
`ok:true` 观察。SA7 独立动态交叉验证：

| SA3 声明 | SA7 验证 | 结果 |
|---|---|---|
| P2 无预算时尾组首项 q1（`{score:NaN}`）入选即 fail-fast（`['tasks','q1']`） | SA7-C1：无预算 n=4…9 全部 `ok:false`/`PATH_NOT_ALLOWED`/`['tasks','q1']`（asc 与 desc 同） | **证实** |
| `depth:0` 键序观察与 D12 逐条一致且非折叠伪影 | SA7-C2：折叠后每项 value 均为 `{}`（同形空壳）而 s1 仍居第 3 位——分类在折叠前完成；SA7-C1b：**null 孪生 doc**（q1/q2/q3 换为可物化的同组 2 值 null）legacy 全量序与毒值 doc 的 `depth:0` 序**逐键相等**（asc/desc 皆然）——`depth:0` 观察忠实反映真实有序基，非折叠产物 | **证实**（等价观察，语义零改动） |
| P2b 完整序列 `[2,0,5,1,3,4]` 不可作 `ok:true` 观察（数组面排序键 = 项值本身，非有限标量物化必响） | SA7-B4：`n:6,depth:0` 仍 `ok:false`/`PATH_NOT_ALLOWED`/`['arr',1]`（**毒即叶子标量，depth 折叠不救**——SA7 探针初版误设此期望而实测红，反向证实该声明）；SA7-C3：legacy 前缀 `[2,0,5]`/`[0,2,5]` + fail 身份 1 与 null 孪生有序基逐位一致 | **证实** |

**判定**：两处完成属「fixture 期望本身不可直接观察」的观察面缺口，非语义分歧——D12 期望的有序基在可观察
投影（`depth:0` / 孪生 doc / 前缀+fail 身份）下逐位成立，且杀伤面保持（突变 B 使 P2/P2b 及对应探针红）。
建议路由（非阻塞）：SA1 后续可将该观察纪律回写 D12 文本（设计记录层，勿动 ADR/CONTEXT——§13-R6 既定方针）。

## 7. Preserved Data Flow Verification

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| 姊妹 `readLogicalValueAtPath` 冻结面 | 三参签名/无 options 语义/缺席吸收逐字不变 | `git diff`（read.ts 零行）+ 契约 NC1/NC2/NC3（45/45 内绿） | SA6 基线 674 用例绿 | 包级 729 绿（含 674 基线全量）；read.ts/carrier.ts `git diff` = 0 行 | ✅ |
| readData/ADR-0024 options 闭合形状 | `READ_OPTIONS_INVALID` 家族零触碰；预算轴语义原样（`-0` 归一） | 契约 NC2/NC3；pins/探针 `depth`/`maxChildrenPerNode` 透传（A2 值精确、C2 折叠语义） | 同上 | 同上；`depth:0` 折叠与 ADR-0024 同形空壳一致 | ✅ |
| 纯加法公共面 | 新导出仅经 `src/index.ts`；守卫逐导出记账；无别名 | 守卫 P-W1/P-W2（6/6 绿）+ 类型守卫（typecheck 绿） | SA6 基线 32 文件 | `Object.keys(ns)` 含 `/Window/` 者恰两枚值导出；13 类型名目可导入 | ✅ |
| W2/W3 排除（Owner 负向清单） | namespace-runtime/registry、schema 通道、lease 四键结算零涉及 | `git status/diff`（零改动）+ 全仓 grep | — | 窗口导出消费面 = doc-runtime src/test 自身；namespace-\*/docs/CONTEXT 零 diff；成功面恰 `{ok,value}` 无 `kept/total/truncated` 投机字段 | ✅ |
| 只读无副作用 | 零 update 事件、零订阅、模块级零可变态 | SA7-A4（`doc.on('update')` 计数） | — | 成功/失败/缺席/不符/非法/G0 全类调用后 updates=0；A7 失败后重入结果逐字节一致（无状态复活） | ✅ |

## 8. State Machine Verification

单次调用流水线（G0→OPT→N0→N1→C→E/S→M→A，设计 §8.1；无跨调用状态）：

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| 调用入口 | 非数组 path（叠加非法 options） | G0 → `PATH_NOT_ALLOWED`（先于 OPT） | A6 实测 `PATH_NOT_ALLOWED` | 未出现 OPT 先行（options 码） | ✅ |
| G0 通过 | 非法 options（叠加缺席 path） | OPT → `WINDOW_OPTIONS_INVALID`（先于导航，零 doc 触碰） | A6 实测；A5 accessorRuns=0 | 未出现导航先行（ABSENT 码） | ✅ |
| OPT 通过 | path 缺席段 / detached / 面不符 | N1 → `WINDOW_TARGET_ABSENT`；detached → `PATH_NOT_ALLOWED`；面不符 → `WINDOW_CARRIER_MISMATCH` | A6 + pins P5/P6a、契约 G1/G2 | 未出现缺席吸收回渗（`ok:true` 吸收值）——NC1 成对绿 | ✅ |
| 载体面通过 | 含毒未入选项（n 截断在外） | E/S 分类排序 → M 只物化入选项 → `ok:true` | B5：`[1,NaN,2]` n:2 → ok（NaN 零读取） | 未出现全量物化（哨兵有牙，NC5/F 组绿） | ✅ |
| M 阶段 | 入选项物化失败 | 首败即整窗失败（fail-fast）→ 失败联合 | A1/A3/C1（身份 n 不变、有序基序） | 未出现半窗/跳项/补位/伪成功（突变 A 全红） | ✅ |
| 任意终态后 | 重复/失败后再调用 | 结果逐字节一致、doc 不变 | A1（3×）/A7/B3（5×） | 未出现旧路径复活或状态残留 | ✅ |
| 空路径 `[]` | map face / array face | ROOT 窗口 / `WINDOW_CARRIER_MISMATCH` | pins P5（fresh → `[]`；含键 → 键窗口） | 未出现吸收或抛出 | ✅ |

## 9. Error and Cleanup Flow

- 错误分类四码各就各位且互异（契约 G8 + A6 差分：同一 doc 上 ABSENT/MISMATCH/OPTIONS_INVALID/PATH_NOT_ALLOWED
  各自由正确触发器产生）；全部同步返回、零外抛（A1/A5 `not.toThrow`）。
- 透传 message 非空且为姊妹原文（A1：`non-finite number（目标.bad）`）——D8「message 带姊妹原始 message」兑现。
- cleanup/quiescence：纯读原语零资源——A4 update 计数 0；探针运行后无残留进程/文件（`job` 收尾、临时文件删除）；
  敌意 options 探测期零 accessor 执行（A5）。
- 无部分完成状态：失败联合无 `value`（A1）；成功结算幂等（B3/A7）。

## 10. Temporary Diagnostics

| 项 | 内容 | 清理 |
|---|---|---|
| 添加 | 临时探针测试 `packages/doc-runtime/test/sa7-368-dynamic-probe.test.ts`（17 场景 A1–A7/B1–B5b/C1–C3；`[SA7-DATAFLOW]` 前缀仅 route/step/关键值；零 secret/零 live dump/零控制流改变）+ 突变探针 2 枚（`window.ts` 临时单行改动） | 探针文件已删除；突变已还原 |
| 运行证据 | 探针 17/17 绿（19 条 `[SA7-DATAFLOW]` 观察，逐字转录本报告 §3–§6）；突变 A = pins 5 红 + 探针 6 红（契约仍绿）；突变 B = pins 2 红 + 探针 8 红（契约仍绿） | 观察记录存档 `artifacts/sa7-issue368-{dynamic-probe,mutationA,mutationB}.log`（untracked 观察记录，不入 artifactPaths） |
| Post-removal 验证 | 删除后复跑：契约+pins 定向 **56/56 绿**；包级（含 typecheck）**34 files / 729 tests / Type Errors no errors**；`tsc -p packages/doc-runtime` exit 0——与探针在场时一致 | ✅ |
| 残留检查 | `window.ts` sha256 还原一致（`7c765939…364`）；`grep -rn "SA7-DATAFLOW\|SA7 MUTATION"` 于 packages/ 零命中（仅 wiki/raw 历史报告既有文本与 artifacts 观察记录）；`git status` 变更集 = SA3 ALLOW LIST 六路径 + 本报告 + artifacts 观察记录，零越界 | ✅ |

## 11. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| Design（D8/§9） | fail-fast 透传防静默跳项/半窗 | pins P1/P6b + 探针 A1–A3/A7 + 突变 A | 整窗失败、path 到项、无 value | 一致；突变 A 被捕获 | §4、artifacts 日志 | ✅ | — |
| Design（D4/D10/§8.1-S） | non-finite 归尾 + 总序确定性 | pins P2/P2b/P8 + 探针 B1–B4b + 突变 B | 尾组恒居尾、锚恒 asc、插入序无关 | 一致；突变 B 被捕获 | §5 | ✅ | — |
| Design（D12/SA3 Deviations） | pins 观察面完成是否忠实 | 探针 C1/C1b/C2/C3 + null 孪生 doc | 深度折叠观察 ≡ 真实有序基 | 逐键相等；数组面毒叶不可折叠救活实证 | §6 | ✅ | SA1 可回写 D12 观察纪律文本（非阻塞，设计记录层） |
| SA6（§12.7 红线/AC1–AC6） | 契约 45/45、守卫记账、纯加法、typecheck/test 全绿 | 契约+ pins + 守卫 + 包级/root 门 | 全绿 | 45/45、11/11、729、4445、exit 0 | §12 | ✅ | — |
| SA6（§3 冻结面） | 姊妹/readData/W2/W3 零回渗 | git diff + NC1–NC3 + 全仓 grep | 零改动 | read.ts 等 0 行 diff；窗口面无外部消费 | §7 | ✅ | — |

## 12. Commands and Evidence

| # | 命令 | 结果 |
|---|---|---|
| 1 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/doc-runtime --typecheck.enabled=false` | 31 files / **707 passed**（runtime 面） |
| 2 | `pnpm typecheck`（root，14 tsconfig） | **exit 0** |
| 3 | `NODE_OPTIONS=--conditions=nomicore-source pnpm test`（root，含 typecheck；探针加入前采集） | **380 files / 4445 tests passed / Type Errors no errors / exit 0**（621s） |
| 4 | 探针（在场）：`vitest run packages/doc-runtime/test/sa7-368-dynamic-probe.test.ts --typecheck.enabled=false` | **17/17 passed**；19 条 `[SA7-DATAFLOW]` 观察 |
| 5 | 突变 A/B：临时改 `window.ts` 单行 → 同 runner 跑 pins+契约+探针 | A：**11 failed**（pins 5 + 探针 6；契约 0）；B：**10 failed**（pins 2 + 探针 8；契约 0）；还原后 sha256 逐字节一致 |
| 6 | Post-removal：删除探针 → 契约+pins 定向 | **56/56 passed** |
| 7 | Post-removal：`vitest run packages/doc-runtime`（含 typecheck）+ `tsc -p packages/doc-runtime/tsconfig.json` | **34 files / 729 tests / no errors**；tsc exit 0 |
| 8 | `git diff --name-only` / `git status --porcelain` / 冻结面 diff 计数 | 变更集恰 = 设计 §11 ALLOW LIST（window.ts 新建、index.ts +19、守卫两文件加法、pins 新建、契约文件 untracked 原样）+ wiki 产物；read.ts/carrier.ts/namespace-\*/docs/CONTEXT **0 行 diff** |

## 13. Deviations

1. **SA4 复核报告缺席**：`wiki/raw/task_issue-368_sa4_review.md` 在本轮 dispatch（phase final-verification）时
   不存在——SA7 无法消费 SA4 产物；因无 SA4 reject 在案，SA7 独立完成动态验证并给出 approve（未下调任何
   SA4 verdict）。若 SA4 后续 reject，以 SA4 为准。
2. **SA7 探针初版两处测试侧错误**（已修正，非实现问题）：① C1 增量前缀累积重复计数；② B4/C3 误设
   「数组面 `depth:0` 全序列 ok:true」期望——实测证伪（毒即叶子标量），该证伪本身构成 SA3 偏差 #2 的独立
   动态反证，已改用 null 孪生 doc 交叉验证。
3. **SA3 两处 pins 观察面完成**：经 §6 交叉验证判定为忠实等价观察（非语义分歧），无需实现改动；建议 SA1
   回写 D12 观察纪律（非阻塞）。
4. root `pnpm test`（命令 3）在探针文件加入前采集（380/4445，与 SA3 记录一致）；探针在场的包级增量证据由
   命令 4/5 承担，post-removal 复跑（命令 6/7）确认删除后结果不变。

## 14. Verdict

**approve**

- 设计声明改变的数据流（W1-R1…R5）全部按设计变化运行（§3）；声明保持的路线（姊妹冻结面、纯加法、W2/W3
  排除）全部保持（§7）；
- 状态机定序与关键值正确，禁止转换（半窗/跳项/补位/缺席吸收回渗/全量物化）未出现（§8）；
- 错误与清理符合设计：四码各就各位、fail-fast 无泄漏、零副作用、幂等（§9）；
- 三焦点（fail-fast 传播、non-finite 尾组确定性、pins 观察面语义）均有独立运行时证据且突变有牙（§4–§6）；
- 临时诊断已清理，post-removal 验证结果不变（§10）。
