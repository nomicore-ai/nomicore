# SA6 诊断与验收契约 — issue #368 W1：`@nomicore/doc-runtime` 载体级窗口原语（ADR 0028）

- 任务类型：**feature**（能力缺口证明 + 目标行为验收契约；不虚构 Bug 根因）
- 被审对象：issue #368「W1: doc-runtime 载体级窗口原语——确定性选窗、条目列表、零物化、三失败码（ADR 0028）」
  （brief `wiki/raw/task_issue-368.md`；Parent PR #367；labels in-progress/feature）
- Worktree / 基线：`/home/wangjian/nomicore-fix-issue-368`，branch `mabf/issue-368`，
  HEAD `36a73bb4485d3380fd6f61464163d81ec8d654a9`（`docs(adr): ADR 0028 窗口读——readArray/readMap 确定性选窗（设计基线）`）
- 结论：`approve` —— 能力缺口稳定可证（公共面零窗口原语 + 包源码零窗口面）；契约可执行且红在正确断言处
  （39 红全部 = 「入口未导出」能力缺失，非 fixture/环境/超时/入口错误）；负控 6 条全绿并证明哨兵有牙；
  测试入口真实（被 `vitest.config.ts` include 与 root `pnpm test` 采集）。设计自由项（绑定名/结果形状）
  已单列 §12.1；实现前由 SA1 冻结，零生产实现改动（本报告只交付契约与红灯）。

---

## 1. Task type and inputs

| 输入 | 用途 |
|---|---|
| `wiki/raw/task_issue-368.md` | Host task brief：issue #368 正文 What-to-build + AC1–AC6 + Blocked by |
| `wiki/raw/task_issue-368_conflict_report.md`（iteration 1） | SA8 前置门禁：11 项决策对照、冻结面 7 行、实现期红线、注记 3/4（non-finite 边角、等价锚对账基）；verdict `reject`（唯一阻塞 = 时序） |
| `wiki/raw/task_issue-368_conflict_report_iter2.md`（iteration 2） | SA8 前置门禁重裁：Owner scoped override 实证（REST）+ 范围正/负向 + verdict `clear` + `requiresConflictRecheck: true` |
| `wiki/raw/task_issue-368_relevant_decisions.md` | 决策摘录（ADR 0028 决策 2/3/4/5/6/7/8/9、ADR 0024、ADR 0016 L82、ADR 0008 L20/L229、模块 AGENTS、CONTEXT 词条） |
| `docs/adr/0028-window-read.md` | 主契约：决策 2/3/4/5/7/8/9-子弹 1（全文逐条引用见测试头注释与本报告 §12） |
| `docs/adr/0024-readdata-shape-budget.md` | 预算轴语义（depth/maxChildrenPerNode）与封闭 options 先例；决策 9 明文「ADR-0024 的 options 零改动」 |
| `docs/adr/0016` L82 / `docs/adr/0008` L20/L229 | 姊妹原语 `readLogicalValueAtPath(doc, path, options?)` 签名与语义冻结面 |
| `packages/doc-runtime/AGENTS.md` | 公共 API 仅经 `src/index.ts`；公共面守卫测试逐导出记账；公共类型变更须跑 root typecheck/test |
| `packages/doc-runtime/src/{index,read}.ts` | 现状源码事实：值导出 9 枚、无窗口面；姊妹 legacy/预算语义与失败码现状 |
| `packages/doc-runtime/test/*` | 现有 32 个测试文件（674 用例）作基线；契约套件的负控锚 |
| Issue #368 REST 评论 5652697060 | Owner override 原文（本轮 `gh api` 实读；见 §2） |

Issue 评论数：1（即 Owner override 评论本身）；无其他评论、无标签操作（本轮零写操作）。

## 2. Owner comment mapping

评论 5652697060（`welltop-jim-wang`，`author_association: OWNER`，`created_at = updated_at = 2026-09-13T10:24:57Z`，
`gh api repos/welltop-jim-wang/nomicore/issues/comments/5652697060` 实读）：「Owner Override：seam-1（本票 W1）豁免
ADR-0027 时序门禁」。

| Owner 评论条款 | 本契约落点 | 证据 |
|---|---|---|
| 覆盖：#368 全部验收面——载体级选窗原语、条目列表、排序总序、零物化哨兵、三失败码、敌意 options 校验 | §12.2 AC1–AC5 全部转为可执行用例组（A/B/C/D/E/F/G/H） | 评论正向清单逐项 ↔ 测试 describe 组 |
| 「纯加法、schema 无关」 | §12.5 非目标：不触 schema 通道、不触 lease 四键结算；§12.7 红线（不改姊妹签名/options、ValueSchema、wire） | 评论 + ADR 0028 决策 9-子弹 1；ADR 0024 决策 1 |
| 「开工与合入（挂 Parent PR #367）」 | 本契约不涉 PR 操作；红灯契约供 SA1/SA3 在 #368 内消费 | iteration 2 §3 合入路径 |
| 不覆盖 #369（W2 lease 公共面）及以后（schema 通道依赖 #363 T1 / #364 T2） | §12.5 非目标：不建立 lease 层 `readArray/readMap` 公共面、四键 `{ok,value,schema,truncated}` 结算、元素口径投影文本任何断言 | 评论负向清单；iteration 2 §4 override 表 |
| 不覆盖 #370（W3） | 同上（registry/类型别名零涉及） | 评论 + 依赖边实测 |
| 时序豁免的承重性 | 本契约只覆盖 seam-1（doc-runtime 载体原语）——即 T1/T2 未落地时可完成的一切 | iteration 2 §2 依赖边实测表 |

## 3. SA8 constraints（逐条纳入，含冻结面与移交义务）

| SA8 约束（来源） | 本契约落点 | 证据 |
|---|---|---|
| 裁决：override-authorized（iteration 2 §3/§4/§6） | 契约的取证范围锁定 seam-1；§12.5 非目标排除 W2/W3 | override 表 1 行 |
| 冻结面：`readLogicalValueAtPath` 三参签名与无 options 语义逐字不变 | NC1（两键成功面 + 缺席吸收）、NC3（预算四键面） | 测试实测绿 |
| 冻结面：readData options 闭合形状与 `READ_OPTIONS_INVALID` 家族零触碰 | NC2（`n`/`orderBy`/未知键在姊妹面一律 `READ_OPTIONS_INVALID`） | 测试实测绿 |
| 冻结面：ValueSchema 9-kind / wire 表面零接触 | §12.5 非目标；契约零涉及 | ADR 0028 决策 3/9 |
| 冻结面：ADR 0028 v1 词表（WindowTerm 闭合联合、条目两形、总序、三码名、n≥1、零物化、成本界） | A/B/C/D/E/F/G 全部断言逐条对齐决策 2/3/4/5/7/8 | 测试头注释 + §12.2 |
| 冻结面：doc-runtime 公共面纪律（新导出仅经 `src/index.ts`，守卫测试逐导出记账） | §12.7-1 实现期义务；NC6 纯加法回归锚 | AGENTS.md；iteration 2 §5 末三行 |
| 冻结面：`WINDOW_TARGET_ABSENT` 不吸收语义**只属窗口原语**，不得回渗姊妹 E1 吸收 | G1（窗口缺席响亮）与 NC1（姊妹吸收）成对 | 测试实测 |
| 红线：`readArray` 语境传 `field`/`'key'`、`readMap` 语境传 `'index'`、多段 field 响亮拒绝 | G4 | ADR 0028 决策 2/7 |
| 红线：等价锚对账基 = `readLogicalValueAtPath(项路径, 同 options)`（注记 4） | E1–E5：入选项 ≡ 同预算逐项读（doc-runtime 层，不用 lease 口径 `readData`） | 测试实测 |
| 移交 SA1：注记 3 non-finite 排序边角（组归属无条文） | 契约只把 non-finite 用作**未入选子树内的毒值**（F 组），**不**对其排序组归属设断言；§15-2 登记为 SA1 钉死项 | F 组 fixture |
| 无冲突项保留：ADR 0016 L82 / ADR 0008 L20 姊妹定位 | B-3/B-5 绑定表按姊妹风格（载体级、schema 无关、判别联合结算） | §12.1 |

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 环境 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；typescript `5.9.3`；`pnpm install --frozen-lockfile --prefer-offline`（65 包，全部复用本地 store，0 下载） |
| 测试入口 | `NODE_OPTIONS=--conditions=nomicore-source vitest run`；root `pnpm test` = `vitest run --typecheck`，include `packages/*/test/**/*.test.ts` + `*.test-d.ts`，`maxWorkers: 1` |
| doc-runtime 基线（新契约文件之前） | 32 个测试文件 / **674 用例全绿**；`tsc -p packages/doc-runtime/tsconfig.json` OK（root typecheck 见 §13） |
| 契约文件加入后 | `vitest run packages/doc-runtime`：33 文件 **1 failed / 32 passed**、用例 **39 failed / 674 passed (713)**、`Type Errors: no errors` |
| root `pnpm typecheck`（契约文件在场） | **exit 0**，14 个 tsconfig 全过、零输出错误 |
| root `pnpm test`（契约文件在场） | **1 failed / 378 passed（379 文件）**、**39 failed / 4390 passed（4429 用例）**、`Type Errors: no errors`——唯一红文件 = 本契约；其余 378 文件 4390 用例全绿 |
| 红灯内容 | 39 红全部为「公共入口未导出窗口原语」能力缺失断言；零 fixture/超时/环境/入口错误（§13 逐因核验） |

## 5. Positive reproduction（能力缺口复现：feature 的「正例」= 能力整体不存在）

1. **公共面探针**（`tsx` 直读 `packages/doc-runtime/src/index.ts`，HEAD 36a73bb，实跑）：

   ```text
   exports: ["DocRuntimeFatalError","MUTATION_GUARD_MISMATCH","applyValidatedMutation",
             "createInitialDocument","extractYjsSnapshot","materializeRoot","readLogicalValueAtPath",
             "replaceRootContent","replaceSchemaAndRoot"]
   window-ish: []
   readArrayWindowAtPath: undefined
   readMapWindowAtPath: undefined
   ```

2. **包源码探针**：`grep -rniE "window|orderBy|WINDOW_" packages/doc-runtime/src/` **零命中**——载体级窗口面
   在实现层也不存在（不是「仅有内部实现未导出」）。

3. **行为探针（最小输入）**：`readLogicalValueAtPath(doc, ['arr'])` 是唯一读入口；对同一 fixture 的 Y.Array
   终点，任何窗口调用面（`n`/`orderBy`）都不存在——三参重载只接受 `depth`/`maxChildrenPerNode`，窗口专属键
   被封闭形状拒绝（NC2 实测 `READ_OPTIONS_INVALID`）。即：**当前能力只能「全量物化 + 宽度前缀截断」，
   不存在「按排序项确定性选窗 + 只物化入选项 + 条目列表」的公共可观察面**。

4. **红灯复现率**：契约套件连续三轮（G6/G7 绑定前置微调前后 + 最终状态复跑）均为 **39 failed / 6 passed**，
   逐条红因同一：`AssertionError: W1 能力缺口：@nomicore/doc-runtime 公共入口未导出 readArrayWindowAtPath
   （数组窗口原语；ADR 0028 决策 9-子弹 1）——实际 undefined: expected 'undefined' to be 'function'`
   （39 条全部在测试首部的 `windowEntry` 能力断言处失败）。复现率 100%，无时序/并发依赖（纯同步读，无服务）。

## 6. Negative control（当前全绿，实现后必须保持全绿）

「W1-NC」组 6 条全部不调用未实现入口，锚定冻结面与 fixture 健全性（实测 6/6 绿）：

| 负控 | 断言 | 证明什么 |
|---|---|---|
| NC1 | 姊妹无 options 读：缺键/中间缺键 → `{ok:true, value:undefined}` 且恰两键 | 缺席吸收 E1 不受窗口「不吸收」语义回渗；fixture 路径合法 |
| NC2 | 姊妹三参收 `{n}`/`{orderBy}`/`{depth,n}`/未知键 → 全 `READ_OPTIONS_INVALID` | readData/姊妹 options 闭合形状零改动；窗口能力不得借姊妹通道泄漏 |
| NC3 | 姊妹预算成功面恰四键 + `truncated === true` | ADR 0024 五键/四键结算面冻结 |
| NC4 | 排序/键/field 三 fixture 经姊妹全量读 == 预期普通值 | **红不是 fixture 坏**：同一 Y.Doc 构造在既有实现下语义健全 |
| NC5 | 毒值 fixture 经姊妹全量物化 → `PATH_NOT_ALLOWED`（non-finite / 稀疏空洞 / 全项读三处） | **哨兵有牙**：F 组 `ok:true` 只有在「未入选子项零物化」时才可能成立 |
| NC6 | 8 枚既有值导出 + `MUTATION_GUARD_MISMATCH` 仍在位 | 纯加法回归锚（不得以改名/换形实现窗口面） |

## 7. Stability, scale and timing

- **确定性**：H1 断言同一 doc 重复调用、孪生 doc 同数据 → 条目列表逐字节一致（`toStrictEqual`）；无时钟/并发/
  网络依赖（纯同步、单线程、单 doc 本地读）。
- **规模**：F5 以 N=2000 的 Y.Array（未入选 1995 项全埋 `non-finite` 毒值）+ `n=5` 作为规模哨兵——若实现
  退化为「全量物化再裁剪」，在 2000 项规模上必红；正确实现只物化 5 项。
- **成本纪律的锚**：ADR 0028 决策 8 的规范锚是**行为哨兵**（零物化）而非墙钟计时；本契约不做出耗时断言
  （避免把 CI 抖动当契约），O(N) 枚举 + field 基单段下钻由 F3（毒值在非排序字段）与 G 组语境外拒绝共同约束。
- **时序/环境条件**：无需服务、无需安装外部依赖（安装仅用于运行 vitest/tsc）；红绿与 `--typecheck` 开关无关
  （含/不含 `--typecheck` 同结果，三轮复现一致）——不依赖任何可选环境量或 env override。

## 8. Capability gap chain（feature：能力缺口链，替代 Bug 根因链）

| Step | 事实 | 证据 | 置信度 |
|---|---|---|---|
| 症状 | 持有 Y.Doc 的调用方无法按排序项取窗口：只能全量投影 + `maxChildrenPerNode` 前缀截断（护栏非选择器） | NC2/NC3 实测；CONTEXT「形状预算」词条分工句 | 高（实测） |
| 直接缺口 | `@nomicore/doc-runtime` 公共面不存在载体级窗口原语（数组面/键面均无） | §5-1 探针：9 导出零窗口命中；两绑定名 `undefined` | 高（实测） |
| 实现层缺口 | 包源码零窗口面（无内部实现未导出） | §5-2 grep 零命中 | 高（实测） |
| 触发条件 | 需要「最新 K 条 / 按字段值选 K 条 / 稳定平局」的窗口选择，而 readData 预算是结构盲护栏 | ADR 0028 背景节（错端/不确定/无规则三问题） | 高（决策文本） |
| 最深根因（本票） | 选窗能力从未作为独立公共面交付：ADR 0028 已接受设计，但实现排期被 ADR-0027 时序条款挡住 | ADR 0028 状态行 L4 + 决策 9 L80；iteration 1 §3-第 9 项 | 高（SA8 已裁） |
| 放大因素 | 无窗口面时，调用方只能全量物化再自行裁剪——既失去「未入选零物化」成本纪律，又无法获得确定性总序 | ADR 0028 决策 8；F 组哨兵 | 高（决策文本） |
| 未证实假设 | 无（本票不含故障假设；non-finite 排序组归属为决策空白，见 §15-2） | — | — |
| 已排除项 | 「能力已存在但命名不同」（§11-1）、「红灯因环境/fixture/入口」（§11-2/3/4） | §11 | 高（实测反证） |

## 9. Causal experiments（控制变量 / 反证）

1. **公共面控制变量**：同一次运行中，既有 9 枚值导出全部在位（NC6 绿），只有两个窗口绑定名 `undefined`
   （39 红）——差异只可能是「窗口能力缺失」，排除安装/转译/条件导出（`nomicore-source` 条件生效，姊妹读可用）。
2. **fixture 健全性控制**：同一批 fixture 经姊妹全量读得到预期普通值（NC4 绿），故红灯不来自 Yjs 构造错误、
   路径写错或测试入口错误。
3. **哨兵灵敏度反证（毒值有牙）**：同一毒值经姊妹全量物化必红（NC5 绿）——F 组要求窗口调用 `ok:true`，
   只有真正「未入选零物化」才可能通过；「先全量物化再选」的退化实现必然红。
4. **退化策略差分（each wrong policy ≠ expected，逐组有命名断言）**：

   | 退化策略 | 与契约期望的首个差异位 | 命中用例 |
   |---|---|---|
   | 不排序（插入序/下标序直出） | asc 期望第 0 位（`1` vs `0`） | A1/A3/A4 |
   | desc = 把 asc 结果整体倒序 | desc 期望第 0 位（`2` vs `8`，倒序会让不可比组领先） | A2/A4 |
   | desc 时连平局锚一起翻转 | 不可比组尾段第 0 位（`5` vs `8`） | A4 |
   | field 基 desc 时平局翻转 | 第 1 位（`t7` vs `t1`） | C2 |
   | 字符串按 UTF-16 码元序 | A7 第 1 位（码点序 `1` vs 码元序 `0`） | A7 |
   | 全量物化再裁剪 | F1–F5 `ok:true` 断言必红（non-finite/稀疏空洞） | F1–F5 |
   | 终点宽度误用 `maxChildrenPerNode` | E3 条数 3 vs 1（且与逐项等价锚不一致） | E3 |
   | 缺席吸收 / 载体不符混淆 | G1/G2/G8 码名与互异性 | G 组 |

5. **语义分层实验**：`readLogicalValueAtPath` 三参对 `{n:1}` 的拒绝（NC2）与窗口用例对 `{n:0}` 的拒绝（G3）
   同场对照——证明窗口规则不寄生在姊妹 options 上（ADR 0028 决策 9「readData/ADR-0024 options 零改动」）。

## 10. Impact surface

- `packages/doc-runtime/src/index.ts`：W1 预计新增公共值导出（数组窗口 / 键容器窗口，绑定名见 §12.1）；
  AGENTS 要求公共面守卫测试逐导出记账——SA3 必须同步更新 `public-surface-guard.test.ts` /
  `public-surface-type-guard.test-d.ts`（属「纯加法」允许范围）。
- `packages/doc-runtime/src/read.ts`：零改动红线（姊妹签名/语义/options）；窗口实现可复用既有载体分类/投影纪律，
  但不得改其可观察行为（NC1–NC3 锁定）。
- `packages/namespace-runtime` / `namespace-registry`：**本票零接触**（W2 #369/W3 #370 范围，Owner override 未覆盖）。
- wire / 持久化 / 诊断日志 / schema 生成：零接触（读原语、schema 无关）。
- 文档面：ADR 0028 与 CONTEXT「窗口读」词条已在设计基线（分支局部提交 `36a73bb`）；W1 实现无需文档改动
  （SA8 iteration 1 §8-1/§6-2 已裁定 override 路径零文档改动）。

## 11. Ruled-out hypotheses

| 假设 | 结论 | 反证 |
|---|---|---|
| 1. 窗口能力已存在，只是命名/绑定不同 | **排除** | 公共面 9 导出全枚举零 `window|Window` 命中；包源码 `grep -rniE "window|orderBy|WINDOW_"` 零命中；两个绑定名均 `undefined` |
| 2. 红灯来自环境/安装/依赖 | **排除** | 同一次运行中 674 个既有用例全绿、`Type Errors: no errors`；packages 内其它 32 个文件全绿 |
| 3. 红灯来自 fixture 构造错误 | **排除** | NC4：排序/键/field 三 fixture 经姊妹全量读 == 预期值 |
| 4. 红灯来自测试入口/收集错误 | **排除** | 套件被采集并执行：45 用例（39 红 + 6 绿），报错定位到测试内 `windowEntry` 断言，非 import/collect 错误 |
| 5. 红灯来自断言过强（超出 ADR） | **排除（绑定项除外）** | 每条断言标注 ADR 决策出处；唯一设计自由项（名字/结果形状/orderBy 单复数）集中在 §12.1 绑定表，可无损重绑 |
| 6. 契约以源码字符串断言代替行为验证 | **排除** | 全部断言锚定运行时结果联合、条目列表、Y.Doc 值、异常观测；无 grep/正则/源码读取 |
| 7. 负控是伪绿（fixture 不触发目标路径） | **排除** | NC5 证明毒值经全量物化确实响亮失败；NC2 证明姊妹封闭形状确实拒绝窗口键 |

## 12. Acceptance contract and test paths

### 12.1 契约绑定表（SA1 冻结；只承载名字/调用形状，语义断言不随绑定变化）

| # | 绑定 | 契约默认取值 | 依据 / 若 SA1 另择的处置 |
|---|---|---|---|
| B-1 | 数组窗口公共值导出 | `readArrayWindowAtPath` | ADR 0028 决策 9-子弹 1「载体级窗口原语 = `readLogicalValueAtPath` 姊妹、schema 无关」；命名属 SA1 自由（iteration 1 注记 2）。改绑只动测试 §绑定 常量 `ARRAY_WINDOW_EXPORT` |
| B-2 | 键容器窗口公共值导出 | `readMapWindowAtPath` | 同上（决策 1 的 lease 层两方法名 `readArray`/`readMap` 属 W2，不在此层预占） |
| B-3 | 调用形状 | `(doc, path, options?)`；options = `{n, orderBy?, depth?, maxChildrenPerNode?}` | 决策 1 的 options 轴 + 决策 2/4；`n` 必填 ≥1 整数（issue 失败码条 + 决策 7） |
| B-4 | `orderBy` 形态 | 单个 WindowTerm：`{by:'index'|'key', dir?}` / `{field, dir?}` | 决策 2 的 `type WindowTerm`（单对象、dir 同项成对）；「多字段 = 变项列表」是演进位。**最高风险绑定**：若 v1 冻结为单元素列表，需改 §绑定 适配器（G5 的「列表非法形状」用例随绑定改写） |
| B-5 | 结算形态 | 成功 `{ok:true, value:<条目列表>}`（允许额外字段）；失败 `{ok:false, code:'WINDOW_TARGET_ABSENT'|'WINDOW_CARRIER_MISMATCH'|'WINDOW_OPTIONS_INVALID'}`（只锁 ok/code） | 决策 7 三码名 + 既有判别联合失败惯例；结果形状属 SA1 自由（iteration 1 注记 2）。测试只对成功面断言 `ok`+`value` 存在、失败面断言 `ok`+`code`，不锁键集 |

### 12.2 Issue AC ↔ 可执行用例组映射

| Issue AC | 用例组 | 关键可观察断言 |
|---|---|---|
| AC1 选窗正确性矩阵（基 × dir × 类型组序 × 不可比尾组 × 平局稳定锚，公共入口行为断言） | W1-A1…A8（index 基，Y.Array/plain array）、W1-B1…B3（key 基）、W1-C1…C4（field 基）、W1-H1（确定性） | 条目列表逐项 `toStrictEqual`；两方向组间序恒定；平局锚 asc 恒定；码点序（含 astral 边界） |
| AC2 零物化哨兵（未入选子项埋不可表示值 → `ok:true`） | W1-F1…F5 | 未入选子树内 `non-finite`/稀疏空洞 → `ok:true` 且入选条目精确；N=2000 规模哨兵 |
| AC3 条目列表形态（身份随行、呈现序 = 有序基之序、空容器 → `[]`） | W1-D1…D5（+A/B/C 组的顺序断言） | 条 own 键集恰 `{index|key,value}`；值不含容器壳；四类空容器 → `[]`；`__proto__` 敌意键免疫 |
| AC4 组合式 depth 等价（入选项物化与逐项同预算读逐字节一致） | W1-E1…E5 | 每项 `entry.value` ≡ `readLogicalValueAtPath([...path, index|key], 同预算轴)`；`maxChildrenPerNode` 只治项内部、终点宽度由 `n` 治理 |
| AC5 三失败码各就各位 + 敌意 options 零外抛 | W1-G1…G8 | 缺席/载体不符/规则非法三码分离且互异；`n` 边界；语境外排序项；非法枚举/形状；Proxy trap 与 accessor 零外抛零执行 |
| AC6 `@nomicore/doc-runtime` typecheck + 既有测试全绿；root `pnpm typecheck`/`pnpm test` 绿 | W1-NC1…NC6（本契约冻结面）+ §13 基线 | 纯加法：既有 674 用例保持绿、typecheck 零错（实现后由 SA3/SA7 复核） |

### 12.3 目标行为的最小输入与期望

- 最小输入：`new Y.Doc()` + `doc.getMap('ROOT')` 下挂一个终点容器（Y.Array/plain array 或 Y.Map/plain object），
  调用 `(doc, path, {n, orderBy?, depth?, maxChildrenPerNode?})`。
- 成功期望：`ok:true`，`value` = 有序基前 n 项的条目列表（`{index,value}` / `{key,value}`）。
- 失败期望：`ok:false`，`code` ∈ 三稳定码；同步、不抛（敌意输入也不抛）。
- 与旧实现（HEAD 36a73bb）的对照：旧实现**无该入口**（`typeof === 'undefined'`）→ 39 条目标断言全部在
  「入口存在性」处失败；任何以别名/内部函数冒充的实现在 NC6（公共面纯加法）与 D1/D2（条目形态）处同样红。

### 12.4 负控（必须保持绿）

§6 表 NC1–NC6。特别地：NC1/NC2/NC3 锁定姊妹冻结面；NC4/NC5 锁定 fixture 与哨兵灵敏度；NC6 锁定纯加法。

### 12.5 边界与非目标（不得越界）

- **非目标（W2/#369）**：lease 层 `readArray`/`readMap` 公共面、四键 `{ok,value,schema,truncated}` 结算、`kept n/total N`
  与 ✂ 段事实、registry 透传、类型别名。
- **非目标（W3/#370）**：schema 通道（元素口径投影文本、ADR-0027 T1/T2 依赖）、lease 生命周期相关面。
- **非目标（本契约未锁的设计自由）**：窗口结算是否附带截断事实（`truncated`/`truncations`/`kept/total`）——ADR 0028
  决策 7 的四键是 lease 口径，doc-runtime 层不设断言；空路径 `[]` 是否接受；`field` 含点号的字面键语义；
  plain object 终端上 accessor/继承键的枚举处置。
- **不得发生**：readData 与 ADR-0024 options 形状/失败码改动；`readLogicalValueAtPath` 签名或语义改动；
  `WINDOW_TARGET_ABSENT` 缺席吸收语义回渗姊妹；ValueSchema 联合扩展；wire 改动。

### 12.6 敏感度与伪绿防线

- 精确等值断言（`toStrictEqual` 条目列表）＋ 双方向矩阵：任何「不排序/整体倒序/平局翻转/误用宽度轴」的退化
  都改变首个差异位（§9-4 表）。
- 哨兵经 NC5 反证「毒值确实不可物化」；实现若全量物化必红，若跳过物化则不合法（条目值缺失 → D/E 组红）。
- 失败码断言用严格字符串相等 + G8 三码互异；没有 `expect.anything()`、没有吞错、没有条件分支跳过断言。

### 12.7 实现期红线（交 SA3/SA4/SA7 复核，非本契约执行）

1. 新导出仅经 `src/index.ts`；`public-surface-guard.test.ts` / `public-surface-type-guard.test-d.ts` 逐导出记账。
2. 三失败码名逐字 `WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID`，响亮不抛。
3. 敌意 options/orderBy 封闭形状校验：零外抛、零 accessor 执行。
4. 不得为过契约修改本测试文件的语义断言；若 SA1 冻结不同绑定（§12.1），只允许改 §绑定 常量/适配器并回写本节。
5. non-finite 作为**排序键值**的组归属由 SA1 钉死（§15-2），实现不得临场发明后回改契约期待值。

### 12.8 测试路径

- 新增：`packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts`（39 红契约 + 6 绿负控；
  被 `vitest.config.ts` 的 `packages/*/test/**/*.test.ts` include 采集）。
- 本契约零生产实现改动、零 fixture 外置依赖（fixture 内联于测试文件，便于审计与重绑）。

## 13. Red/green evidence

| 运行 | 命令 | 结果 |
|---|---|---|
| 契约套件（红/绿实况，runtime） | `NODE_OPTIONS=--conditions=nomicore-source vitest run packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts --typecheck.enabled=false` | **1 failed file；39 failed tests / 6 passed（45 用例）**；红因 100% = 能力缺失断言（`expected 'undefined' to be 'function'`），零其它错误类型（`grep -E "AssertionError|Error:"` 过滤后无残项） |
| 契约套件（含 typecheck） | `vitest run packages/doc-runtime`（含 `--typecheck` 配置） | **1 failed file / 32 passed（33）**；**39 failed / 674 passed（713）**；`Type Errors: no errors`——即除本契约组外，doc-runtime 全绿 |
| 负控 | 同上 | W1-NC1…NC6 **6/6 绿**（当前基线） |
| 包/根 typecheck | `tsc -p packages/doc-runtime/tsconfig.json`（经 root `pnpm typecheck`） | **exit 0**，14 个 tsconfig 全过、零错误输出 |
| root 基线 | `pnpm test`（`vitest run --typecheck`） | **1 failed / 378 passed（379 文件）**、**39 failed / 4390 passed（4429 用例）**、`Type Errors: no errors`；唯一红文件 = 本契约，其余 378 文件 4390 用例全绿（即基线全绿、纯增量红） |
| 配对反证 | NC1（姊妹吸收 undefined）↔ G1（窗口缺席响亮）；NC2（姊妹拒窗口键）↔ G3/G4（窗口拒非法规则）；NC5（毒值全量物化必红）↔ F1–F5（窗口 `ok:true`） | 同场实测，方向相反、互不矛盾 |

**红因逐条核验（最终状态复跑）**：`vitest run <契约文件> --typecheck.enabled=false` → `Test Files 1 failed (1)`、
`Tests 39 failed | 6 passed (45)`、退出码 1（预期红灯）；`grep -c "W1 能力缺口"` = 117 次（reporter 重复计数），
`grep -E "AssertionError|TypeError|Error:" | grep -v "W1 能力缺口"` = **0 残项**——39 条失败全部为同一条能力缺失断言，
无 TypeError/import/collect/timeout 类失败；绿色恰 6 条（W1-NC 负控组）。root 运行的红文件与红用例数同源
（同 39 条），非新增错误。

## 14. Runner trigger evidence

- include 正则：`vitest.config.ts` → `include: ['packages/*/test/**/*.test.ts', …]`，本文件路径命中。
- 采集实证：`vitest run packages/doc-runtime` 报告 **33 个测试文件**（基线 32 + 本契约 1），本文件 45 用例被执行
  （39 红 + 6 绿），非「未被收集的空跑」。
- root 入口实证：`pnpm test`（`vitest run --typecheck`）采集同一 include；root 实跑 **379 文件 / 4429 用例**，
  其中本契约文件被采集并执行（39 红 + 6 绿），其余 378 文件 4390 用例全绿、`Type Errors: no errors`；
  root 退出非零**仅**因本契约组的预期红灯（能力缺口），非采集/环境失败。
- 无 skip/only/todo、无 env override：全文件无 `.skip`/`.only`/`.todo`；红灯不依赖任何环境变量
  （含/不含 `--typecheck` 同结果，三轮复现一致）。

## 15. Unknowns and blockers

1. **绑定风险（不阻塞，需 SA1 冻结）**：B-1/B-2 名字、B-4 `orderBy` 单复数、B-5 结算键集属设计自由。
   契约已把绑定集中为常量/适配器；SA1 冻结后由 SA6 回写 §12.1，语义断言不动。若 SA1 冻结「单入口 + 模式参数」，
   需新增适配器并重绑两条入口（语义断言不变）。
2. **non-finite 排序组归属（SA8 iteration 1 注记 3 移交 SA1）**：本契约只把 non-finite 用作未入选子树毒值，
   不设排序断言；SA1 钉死后如需覆盖（number 组内 vs 不可比组）再由 SA6 扩展。
3. **`field` 含点号**：ADR D3 段纪律「段从不拆分、点号是合法键名」与 issue「多段 field 禁止」的解释张力——
   契约只断言 `field: ['a','b']`（非字符串形状）非法，不锁字面点号键的接受/拒绝。
4. **空路径 `[]`**：姊妹接受 `[]`（ROOT）；窗口是否接受未在 ADR 明示——契约不设断言。
5. **窗口层截断事实**：决策 7 四键属 lease 口径，doc-runtime 层是否携带 `truncated/truncations` 未定——契约不锁
   （E 组只比较 `entry.value`）。
6. **plain object 终端键空间边角**：accessor/继承键是否枚举未锁（只锁 `__proto__` 敌意键免疫与零原型污染）。

无阻塞项：能力缺口可稳定复现，契约可执行，红在正确原因，负控全绿，入口真实 → 可进入设计（SA1）。

## 16. Temporary diagnostics cleanup

- 零生产实现改动：`git status --short` 仅显示本契约测试文件（`packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts`）
  及 Host 既有未跟踪输入（`wiki/raw/task_issue-368*.md`）；`packages/doc-runtime/src/**` 与 `docs/**` 对 HEAD 零改动。
- 临时诊断：仅一次内联 `tsx -e` 公共面探针与 `grep` 只读探针，均未落盘、无临时文件、无后台服务残留；
  无 nohup/setsid/PID 文件/轮询 marker。
- 依赖安装为常规 workspace 安装（`node_modules` 未跟踪，无仓库内容改动）。
- 收尾核对：本报告写入固定路径 `wiki/raw/task_issue-368_sa6_contract.md`，无其它新增产物。

---

## Verdict

**approve** —— issue #368 W1 的能力缺口（doc-runtime 载体级窗口原语整体不存在）稳定可证、红在正确断言处
（能力缺失，非环境/fixture/超时/入口错误）；验收契约覆盖 Owner override 正向清单全部六条 AC，含负控与
哨兵灵敏度反证；测试入口真实（root include + 实测采集）；设计自由项已单列绑定表，不预占 SA1 命名。
可进入设计（SA1）阶段；实现期受 §12.7 红线与 SA8 冻结面约束，W2/W3 不在本契约范围。
