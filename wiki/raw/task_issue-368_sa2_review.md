# SA2 设计攻击评审 — Issue #368 W1：`@nomicore/doc-runtime` 载体级窗口原语（ADR 0028 缝 1）

- 被审对象：`wiki/raw/task_issue-368_design.md`（SA1 **iteration 1 评审修订轮**，680 行——按 SA2 iteration 0
  的 F1–F4 原位修订：pins 升格必选 + 三处文本钉死；钉死语义 D3–D8 零改动）
- 评审人：SA2（Reviewer / Wallfacer，dispatch `sa-55102f7f-247d-435d-bbe1-abed6a4ba5e2`，iteration 1）
- Worktree：`/home/wangjian/nomicore-fix-issue-368`（branch `mabf/issue-368`，HEAD `36a73bb`）
- 评审纪律：只读源码/ADR/契约/测试；不实现、不运行测试、不改设计；唯一产物 = 本文件（原位更新 iteration 0
  评审——已解决 finding 移出阻断区，稳定 ID 保留用于修订映射）。

## 1. Reviewed inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-368.md`（任务简报） | 实读 | Issue 正文 + AC1–AC6 |
| `wiki/raw/task_issue-368_design.md`（iteration 1，680 行） | 实读（全文） | 被审修订设计——重点：§1 目标 9、§7-D12（pins 全规格 P1–P8）、§14 修订映射 |
| `wiki/raw/task_issue-368_sa6_contract.md` | 实读（§12.5/§12.6/§12.7/§15 复核） | 契约红线与自由项对账（§12.7-4 契约不可改、§12.7-5/§15-2 non-finite 归组 = SA1 钉死义务） |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | 实读（本轮重读绑定段 L51–98、fixture 段 L117–270、G 组 L606–731） | P1 fixture 同构性（`makeSentinelDoc` L201–217）、NC5 fieldPoison L797–798、C 组锚不可区分性（FIELD_CHILDREN L166–179）、G2 范围（无 detached 冲突）、45 用例计数 |
| `wiki/raw/task_issue-368_conflict_report.md` / `_iter2.md` / `_design_conflict_report.md`（SA8 三轮） | 实读（iteration 3 复重点读） | §8-6 建议（pins 落地）与 #2/#7/#8/#16 裁定——设计 §14 采纳声明逐条核对 |
| `wiki/raw/task_issue-368_relevant_decisions.md`、`docs/adr/0028-window-read.md` | 实读（iteration 0 全文 + 本轮交叉引用） | 决策基线 |
| `packages/doc-runtime/src/read.ts` | 实读（本轮复核 L118–125/L168–192/L259–300/L326–362/L382–497/L720–728/L803–810） | D2 复制集九件行号锚逐条实核；D4 论证 3 的 `copyPlainStrict` `Number.isFinite` 拆支（L723–726）；缺席吸收/响亮纪律锚点 |
| `packages/doc-runtime/src/carrier.ts` L26–38/L53–70、`src/index.ts` L13–44、`packages/doc-runtime/AGENTS.md` | 实读 | §2 锚点 + 公共面纪律（本轮收到包内 AGENTS 指令再确认：新公共 API 仅经 src/index.ts + 守卫逐导出记账——设计 D2/§10/§11 合规） |
| `vitest.config.ts`（test.include/typecheck.include）、`packages/doc-runtime/tsconfig.json` | 实读 | pins 采集与类型检查声明实核（include `packages/*/test/**/*.test.ts` ✓；包级 tsconfig include `test/**/*.ts` ✓） |
| 全仓 grep（`from '@nomicore/doc-runtime'` / `readLogicalValueAtPath`） | 本轮重跑 | SA2-F3 修订的调用方矩阵独立复核 |
| `wiki/raw/task_issue-368_sa2_review.md`（iteration 0，本文件前身） | 实读 | F1–F4 接受条件逐条销项 |

本轮独立复核（非转引）汇总：D2 复制集九件行号全部命中（isNonNegInt L382/segMsg L387/yjsWord L392/isPlainRecord L405/navClassify L436 起（含 detached 前置判别）/readableOwnDataValue L481/readableArrayElement L497/safeSpreadPath L259/safeDetail L277）；生产面 7 文件消费 doc-runtime、姊妹读唯一在 `namespace-runtime/src/runtime.ts`（L40/L570/L582/L593）、vfsl L86 仅注释；契约绑定常量与 D1 逐字一致；契约 C 组 fixture 插入序 = 键序（P2 打乱理由成立）；G2 仅 attached 异面（与 P6a 无冲突）。

## 2. Verdict

**approve** —— iteration 0 的 1 MAJOR（SA2-F1）与 3 MINOR（F2/F3/F4）全部落实并经本轮独立复核：

- **SA2-F1 已解决**：pins 文件 `issue-368-window-read-design-pins.test.ts` 从「可选推荐」升格为**必选**
  （§1 目标 9、§7-D12 全规格、§11 ALLOW 第 5 行、§12 两承重语义行、实现边界摘要 6）。**P1（D8 透传防静默跳项）
  与 P2/P2b（D4 non-finite 归尾）为阻断最小集**，逐字采纳 iteration 0 建议的用例设计并加强（P1 加 path 精确到项
  + message 非空断言；P2 加插入序打乱 + n=5 边界）。本轮逐个重算 P1–P8 期望值**全部正确**，杀伤面真实
  （静默跳项/补位/冒充三码/NaN 归 number 组/尾组随 dir 翻转/锚用插入序/码元序锚/点号拆分全部必红）。
- F2/F3/F4 逐条销项（见 §6/§9/§10 与 §13 映射）；非阻断观察 1–5 全部妥善采纳或确认。
- 修订为**验收设计充分性修复**：全部钉死语义（D3–D8）零改动（设计声明与正文实读一致），不触碰任何 SA8 已裁
  边界、不扩 Owner 授权面（pins = 纯测试加法，W1 seam-1 内，零 schema/W2/W3 面）。
- 无新 BLOCKER/MAJOR。残留两点非阻断观察（见 §14）：G0/N0 导航纪律位无专锚（E100 镜像可观测吸收，无伪绿通道）；
  P3 fixture 载体形态未显式点名（同构性下两形态皆可）。

`pass` 仅表示设计通过审查；SA4/SA7 对实现与活链路的验证义务不变（设计 §15 实现轮复查清单已就位）。

## 3. 需求覆盖

| Requirement（issue 正文 What-to-build / AC） | Design section | Assessment |
|---|---|---|
| 载体级窗口原语、`readLogicalValueAtPath` 姊妹、schema 无关 | §1 目标 1、D1/D2、D11 | 覆盖；两值导出 + 类型导出仅经 `src/index.ts`（AGENTS 纪律） |
| 确定性选窗（类型组总序 × dir × 平局锚） | D3/D4/D10、§8.1 E/S | 覆盖；D3 张力钉死维持 iteration 0 已验证读法（SA8 iteration 3 #2 no-conflict） |
| 数组按下标基 / 键容器按键码点序或单段 field 基 | D3、D5（+P3 锚）、D10（+P8 锚） | 覆盖；D5/D10 由可选记录升格为必选可执行锚 |
| 统一条目列表（身份随行、呈现序 = 有序基之序、值不含壳、空容器 → `[]`） | D6（+P4 锚）、D11、§8.1-A | 覆盖 |
| 组合式 depth 等价 | D7-M、§12 AC4 行（契约 E 组） | 覆盖；等价锚由构造保证 + **P1 封堵 E 组盲区**（被跳条目不可见） |
| 零物化（毒值未入选 → `ok:true`） | D6/D7、F 组 + NC5 | 覆盖 |
| 成本纪律 | D7 成本段、R4 | 覆盖（SA8 iteration 3 #8 已裁） |
| 失败三码响亮不抛 + `PATH_NOT_ALLOWED` 透传 | §9、D7/D8（+P1/P6 锚） | 覆盖；**透传语义现有直测锚**（iteration 0 缺口已补） |
| 敌意 options 封闭形状校验、零外抛 | D9、契约 G6/G7 | 覆盖（iteration 0 已逐样本 traced，本轮未变） |
| AC1–AC6 | §12 映射表（AC6 行新增 pins 全绿要求） | 覆盖；执行归 SA3/SA7 |
| 目标/非目标未静默扩大 | §1 非目标 + 「pins 升格不扩 Owner 授权面」注 | 覆盖；本轮复核确认 |

## 4. Owner评论覆盖

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| 5652697060（`welltop-jim-wang`，OWNER，issue #368 唯一评论） | 2026-09-13T10:24:57Z（created = updated，零编辑；SA8 iteration 2/3 REST 双重复证） | §4 映射表（5 行逐条） | 覆盖：正向清单（#368 全部验收面、纯加法、schema 无关）↔ §1 目标 1–9；**pins 升格 = 验收设计行为，属「全部验收面 + 纯加法」正向清单内**（§1 注 + §4 行），schema 无关、零 W2/W3；「开工与合入挂 PR #367」↔ 设计即 seam-1 开工产物（PR 操作归 Host/Controller）；负向清单（#369/#370 不覆盖）↔ §1 非目标 + §11 DENY。范围零越界，iteration 2 §7-3 触发器未命中 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA6 契约 39 红 + 6 绿负控；绑定默认 = `readArrayWindowAtPath`/`readMapWindowAtPath` | D1 取契约默认 → 契约文件零改动 | 落实；本轮实读契约 §绑定 常量（L52–53）与 D1 逐字一致 |
| SA6 §12.7-4：不得为过契约改语义断言 | D12：pins 独立文件、不从契约 import、fixture 内联同构并注明出处；§11 DENY 契约文件 | 落实（产物归属分离论证充分：契约是 SA6 产物、pins 是 SA1 设计锚） |
| SA6 §12.7-5/§15-2：non-finite 排序组归属由 SA1 钉死，实现不得临场发明 | D4 钉死 + **必选 P2/P2b 可执行锚** | 落实（该义务的最强兑现路径）；§12 末段纪律：pins 期望与实现冲突退回设计、不临场改期望 |
| 等价锚对账基 = 姊妹同形状调用（SA8 注记 4） | D7-M 按字面调用公共姊妹；E 组盲区由 P1 封堵 | 落实 |
| SA8 iteration 3 §8-6 建议（非门禁）：pins 落地使钉死项可执行 | D12 采纳并升格必选 | 落实；本轮实读 iteration 3 §8-6 原文核对一致 |
| 冻结面 7 行（姊妹签名/options/ValueSchema/wire/v1 词表/公共面纪律/缺席不回渗） | §6 逐行 + DENY 双保险 | 落实（iteration 0 已核，本轮未变） |
| Owner override 范围（仅 seam-1，排除 W2/W3） | §1 非目标、§11 DENY | 落实 |
| 文档面零改动（iteration 1 §8-1/§6-2） | §1 非目标、§13-R6（设计记录 + 必选 pins 双锚定） | 落实 |

## 6. 设计内部一致性（重点：iteration 0 finding 的修订质量）

- **SA2-F1 锚定链闭合**：§1 目标 9 → §7-D8/P1 与 §7-D4/P2/P2b 锚注 → §7-D12 全规格 → §8.1-M/A、§8.2-R4、
  §9 失败表锚列 → §10 pins 调用方行 → §11 ALLOW 第 5 行（必选 + 理由）→ §12 两承重语义行 + AC6 pins 全绿
  → §13-R5/R7/R9 → 实现边界摘要 6/8。**正文全面整合，非附录式伪修订**。
- **D12 P1–P8 期望值本轮全部独立重算**：
  - P1：field = Y.Map{f1:{s:1},f2:{s:2},f3:{s:3,bad:NaN}}（与契约 `makeSentinelDoc` L207–211 逐字同构），
    `n:3` + field:'s' → 三项全选（排序键 1/2/3 全有限）→ f3 物化必败（NC5 fieldPoison L797–798 实证）；
    六断言（不抛/ok:false/code 严格相等/无 value/path=['field','f3']/message 非空）——与 D8「path = 项路径新鲜副本」
    一致；
  - P2：asc `[n1,n2,s1,q1,q2,q3,q4,q5]`（number 组 n1(2)<n2(10) → string s1 → 尾组键 asc q1<q2<q3<q4<q5）✓；
    desc `[n2,n1,s1,q1,q2,q3,q4,q5]`（组间序/尾组不翻转）✓；n=5 两方向第 4/5 位 q1,q2 ✓；插入序打乱
    （q5,q3,q1,s1,n2,q2,q4,n1）下锚用插入序实现得尾组 `[q5,q3,q1,q2,q4]` ≠ 期望 → 红 ✓；
    **打乱理由成立**：本轮实读契约 C 组 fixture（FIELD_CHILDREN t1–t9，Object.keys 插入序 = 键序）——契约内
    插入序锚与键 asc 锚不可区分，P2 补此盲区；
  - P2b：`[5,NaN,1,-Inf,+Inf,'a']` asc `[2,0,5,1,3,4]`（有限 number 组 [2(1),0(5)] → string [5] → 尾组下标
    asc [1,3,4]）、desc `[0,2,5,1,3,4]` ✓；±Inf 归 number 组则 asc 首位变 3 / desc 首位变 4 → 红 ✓；
  - P3：(a) c1 命中字面 `'a.b'`=3（number）→ c3='x'（string）→ c2 缺失尾组 = `[c1,c3,c2]` ✓（拆分实现钻
    c2 到 7 → `[c1,c2,c3]` → 红）；(b) 空串字面键 `[e1,e2]` ✓；
  - P4：n:5 全量窗口下 'u'（显式 undefined 值键）入选条目空间必产生第二条目 ≠ 期望恰 1 条 → 红 ✓
    （n:5 ≥ 候选总数，无「恰被截掉」侥幸通过）；
  - P5/P6a/P6b/P7/P8：语义与期望逐项核对 ✓（P8：0xFFFD < 0x1F600 码点序 `['\uFFFD','\u{1F600}']`，
    码元序 0xD83D < 0xFFFD 得反序 → 红；P7 失败 own 键集与 D11 `WindowReadFailure` 四成员一致）。
- **与既有验收面零冲突**：G2（本轮实读 L616）仅锚定 attached 异面载体——P6a 的 detached → `PATH_NOT_ALLOWED`
  与之不相交；P2 fixture（n/q/s 键族）与契约 C 组（t 键族）独立内联，无期待值交叠；P7 的恰两键自诺严于契约
  B-5「允许额外字段」——契约不锁键集，设计自诺更紧且由自家 pins 执行，合法。
- **钉死语义零改动声明核实**：D3（值键总序+下标 asc 锚）、D4（`Number.isFinite` 门→尾组）、D5（单段字面键）、
  D6（条目空间）、D7（缺席改判 ABSENT + 透传定序）、D8（fail-fast 透传）与 iteration 0 被审文本逐义比对一致
  ——修订只加锚与文本钉死，未动被裁语义。死引用/旧 API：未发现。

## 7. 状态机与并发攻击

同 iteration 0：同步纯函数流水线、模块级零可变态、零订阅——无跨调用状态机。单调用内攻击面更新：

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| SM1 | 调用中 | 并发写事务交错 | yjs 单线程语义吸收（姊妹同域） | 无 | — |
| SM2 | OPT 前 | 敌意 path + 敌意 options 双坏 | G0 先于 OPT → `PATH_NOT_ALLOWED` | 无（D7 定序钉死；G0 无专锚但被顶层 E100 镜像可观测吸收——见 §14-1） | — |
| SM3 | 枚举/排序中 | Yjs 抛意外 | E100 镜像收编 → `PATH_NOT_ALLOWED` | 无 | — |
| SM4 | M 逐项物化中 | 第 k 项失败 | fail-fast 整窗失败、无半窗、无跳项、无补位 | **已闭环**——iteration 0 缺可执行锚，现 **P1 直测 + P6b 同通道互证** | — |
| SM5 | fresh doc / 空路径 | `probeRoot` 惰性建 ROOT；`[]` 目标 = ROOT | 键面 ROOT 窗口（fresh → `[]`）、数组面 MISMATCH | 无（**P5 锚**） | — |
| SM6 | 重复调用 / 孪生 doc | 比较器全序 + 身份唯一锚 | 逐字节一致，不依赖 sort 稳定性/插入序/locale | **已闭环**——键面身份锚比较器钉死为 D10 码点比较器（F2）+ **P8 astral 锚** + **P2 插入序打乱锚** | — |
| SM7 | 敌意 path（Proxy 数组） | trap 抛错 | safeSpreadPath 收编 + E100 → `PATH_NOT_ALLOWED` | 无 | — |

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| ER1 | 入选项内投影不可表示值 | D8 透传 `PATH_NOT_ALLOWED`（path 精确到项、message 非空、同步不抛） | 无——**P1 直测**（iteration 0 唯一可执行性缺口已补） | — |
| ER2 | 「静默跳过失败项」退化实现 | 契约 + 守卫全绿（iteration 0 实证伪绿通道） | **已封堵**——P1 六断言使其必红（ok 断言杀跳项转 ok、无 value 杀半窗、code 严格相等杀冒充、path 杀补位错位） | — |
| ER3 | NaN/±Infinity 排序键退化实现（归 number 组） | D4 钉死归尾组 | **已封堵**——P2（field 基，含打乱插入序 + n=5 边界）+ P2b（数组面值键）双锚；±Inf 挤位/NaN 漂移/尾组翻转/插入序锚全红 | — |
| ER4 | 三 `WINDOW_*` 码可见性 | 判别联合 + G8 互异锚 + P7 own 键集锚 | 无 | — |
| ER5 | 非法 options 时触碰 doc | OPT 短路在 N0 前，零 doc 触碰 | 无（V2 镜像） | — |
| ER6 | 敌意 options/orderBy | D9 封闭 descriptor 校验、零外抛零 accessor 执行 | 无（iteration 0 十四样本 traced，未变） | — |
| ER7 | 姊妹冻结面回渗 | NC1/NC2/NC3/NC6 + read.ts 零 diff + D9 独立形状 | 无 | — |
| ER8 | pins fixture 与实现现实冲突（探针误报） | §12 末段 + R9：退回设计，不临场改期望 | 低（P4/P6 探针已记录；其余 pins 仅用契约已验证构造模式） | — |

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| `readLogicalValueAtPath` 既有消费方 | 无——**F3 已修正**：§10 首行标签改「doc-runtime 既有消费方」并按文件注明实际消费面 | 本轮全仓 grep 重跑：生产面恰 7 文件（write/index/runtime/schema-write/errors + registry/create-document/create-diagnostic），姊妹读唯一在 `runtime.ts`（L40/L570/L582/L593），vfsl L86 仅注释——与修订后 §10 首行逐文件一致 | — |
| 新导出（2 值 + D11 类型） | 守卫记账计划在位（§10 两行须加法扩展 + §11 ALLOW）；declaration emit 审计要求新文件零类型错 | 守卫三文件实读（iteration 0）+ 包内 AGENTS 纪律一致 | — |
| SA6 契约文件 | 无——绑定取默认（本轮重核 L52–53 逐字一致）；pins 不 import 契约、不触碰其断言 | 契约实读 + D12 文件纪律 | — |
| 必选 pins 文件（新「调用方」） | §10 已列为须创建调用方行；实现前红于入口存在性（`windowEntry` 同款断言、红因统一） | D12 文件纪律；契约 L66–73 入口解析模式同款 | — |
| W2（#369，未来） | 不预占冻结面（D9 恰两键 + P7 锁键集反而**收紧**了不预占承诺） | §1 非目标、D9/D12 | — |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| 载体级窗口原语 | `@nomicore/doc-runtime`（ADR 0028 决策 9-子弹 1） | `src/window.ts` 新模块 | 正确 |
| 逐项物化 | 既有投影通道（read.ts 公共面） | D7-M 字面调用公共姊妹 | 正确（单一物化事实源） |
| options 校验 / 排序选窗 | 窗口自有 | D9 / §8.1 E-S | 正确（零既有窗口面，iteration 0 grep 已证） |
| 钉死项可执行锚 | SA1 设计产物（测试文件） | pins 文件（SA1 设计锚）与 SA6 契约（验收）分离 | 正确——产物归属分离避免改契约红线 |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| 载体级读原语 + 形状预算 | read.ts 姊妹族 | 命名族/判别联合/失败纪律/descriptor 校验镜像 | 一致 | 沿仓例 |
| 公共面加法先例 | #334 / #111 | 2 值导出 + 类型 + 守卫记账 | 一致 | AGENTS 同款兑现路径 |
| 测试文件自包含绑定常量 | 契约文件 §绑定 模式 | pins 自有绑定常量 + 入口存在性断言（不 import 契约） | 一致 | 同款红灯纪律，产物独立 |
| 窗口/选择器能力 | 不存在（src 零命中） | 新建 | 无可比（已记录未找到） | — |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 物化语义 | read.ts 公共姊妹 | 窗口条目 value = 姊妹产出 | 无（构造同一） |
| 段纪律/载体分类/失败分类 | read.ts | window.ts 复制（零 diff 红线） | **低（已缓解）**——F4 落实后：复制集九件全名目（本轮行号逐条实核）+ `copied from read.ts@36a73bb` 出处标记 + §13 follow-up（冻结解除时抽共享模块）+ SA4 复核清单（逐函数对账） |
| 排序键/候选空间 | window.ts 新逻辑 | 无 | 低 |
| 钉死项语义 | 设计记录 + 必选 pins | 无 | 低（P2 期望冲突退回设计纪律） |

### 生命周期对称性

纯同步读原语：无 register/dispose、无 start/stop、无订阅、无后台任务——无对称性义务；probeRoot 惰性创建沿姊妹既有行为。无缺口。

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二投影实现 | read.ts 双递归 | 无（逐项调姊妹） | 非重复 |
| 第二 options 校验器 | read.ts validateReadOptions | window.ts 自有（词表 disjoint，NC2 锁定） | 非重复 |
| 第二导航循环 | read.ts N1 | window.ts 复制（缺席位唯一分歧） | 接受（零 diff 红线下显式权衡 + F4 出处标记缓解） |
| 第二测试入口绑定层 | 契约 §绑定 | pins 自有绑定（不 import 契约） | 接受——契约 §12.7-4 不可改红线的必然结果，红灯纪律同款 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW LIST 五路径与正文一致；pins 行升格必选并给出 SA2-F1 理由 + P1–P8 摘要 | §1/§7/§8/§10 涉及面全部在 ALLOW；`package.json`/`tsconfig.json` 零需改（根导出 + include 自动覆盖，iteration 0 已核，本轮复核 vitest include） | — |
| DENY LIST 与正文零冲突；契约文件 DENY 由「pins 不 import 契约」纪律双保险 | 正文无任何 DENY 面改动诉求 | — |
| pins 升格非无理由扩张：理由 = SA2-F1 MAJOR + SA8 iteration 3 §8-6 建议 + 同类零锚缺口（D12 备选节记录否决「只加两锚」的理由） | §11 第 5 行原因列；D12 备选节 | — |
| follow-up 无掩盖必要项：多字段/嵌套 field/partial-selection/复制消除/W2 对账均为演进位或他票范围 | §13 | — |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1 选窗矩阵 | 契约 A–C/H 组（iteration 0 手工重算全对） | 无 | — |
| AC2 零物化哨兵 | 契约 F1–F5 + NC5 | 无 | — |
| AC3 条目列表形态 | 契约 D1–D5 | 无 | — |
| AC4 组合式 depth 等价 | 契约 E1–E5 + **P1 封堵跳项盲区** | 无 | — |
| AC5 三失败码 + 敌意 options | 契约 G1–G8 | 无 | — |
| AC6 typecheck/测试绿 | SA6 基线 + §12 AC6 行（含 pins 全绿） | 无 | — |
| **D8 透传防静默跳项**（iteration 0 伪绿缺口） | **必选 P1**（六断言 + P6b 互证） | **无**——跳项/补位/冒充/吞错全红 | — |
| **D4 non-finite 归尾**（SA8 移交钉死项） | **必选 P2 + P2b**（打乱插入序 + n=5 边界 + 两方向） | **无** | — |
| D5/D6/D7 钉死（点号/空串 field、undefined 值键、空路径、detached） | **必选 P3/P4/P5/P6** | 无 | — |
| 成功恰两键/失败四键（B-5 自诺） | **必选 P7** | 无 | — |
| 身份锚码点比较器（F2） | **必选 P8**（astral 平局两方向） | 无 | — |
| D3 值键总序 | 契约 A1–A8 已锚（D12 不设重复专锚——理由成立） | 无 | — |
| 红绿纪律 | 实现前红于入口存在性（红因统一）、实现后绿、root `pnpm test` 采集（vitest include 本轮实核）、包级 tsconfig 类型检查 | 无 | — |
| 期望值冲突处理 | §12 末段：退回设计、不临场改期望（与 §12.7-4 同纪律） | 无 | — |

## 13. Required revisions

**无**（iteration 0 finding 全部销项，修订映射如下）：

| Finding ID | Severity（iter 0） | 修订验证 | 状态 |
|---|---|---|---|
| SA2-F1 | MAJOR | §1 目标 9 / §7-D4/D8 锚注 / §7-D12（P1–P8 全规格）/ §11 ALLOW 第 5 行必选 / §12 两承重语义行 / 实现边界摘要 6——**iter 0 接受条件逐条满足**：§11/§12 显示必选 ✓、vitest include 采集 ✓（本轮实核）、实现前红于入口存在性 ✓、root pnpm test 采集 ✓（§12 AC6）；P1/P2 逐字采纳建议用例并加强；P2b–P8 采纳「建议随行」（理由：同类零锚缺口 + SA8 iteration 3 §8-6 + 边际成本≈0，否决备选有记录） | **已解决** |
| SA2-F2 | MINOR | D10 身份锚比较器钉死段 + D3 数组面注 + §8.1-S + 必选 P8（astral 平局键两方向锚序） | **已解决** |
| SA2-F3 | MINOR | §10 首行重写为「doc-runtime 既有消费方」+ 逐文件消费面；本轮全仓 grep 独立复核一致 | **已解决** |
| SA2-F4 | MINOR | D2 复制集九件全名目（行号本轮逐条实核命中）+ 出处标记约定 + §13 follow-up + SA4 复核清单 | **已解决** |

## 14. Non-blocking observations

1. **G0/N0 导航纪律位无专锚**：D7-1（非数组 path）/D7-3（ROOT 非 Y.Map）标注「契约未测，钉死项」但 pins
   未设专锚。风险评估：两者均无 `ok:true` 伪绿通道——退化实现（缺守卫）在实战输入下被顶层 try/catch（E100
   镜像）收敛到同一可观察码 `PATH_NOT_ALLOWED`，差异仅 message 精度；与 D8/D4 的静默失败通道性质不同。
   若 SA3 顺手加两行断言（非数组 path / 非 Y.Map ROOT → `PATH_NOT_ALLOWED` 不抛）成本≈0，但不构成实施前
   必要条件。
2. **P3 fixture 载体形态未显式点名**（Y.Map vs plain object）：field 基两形态同构（A6/B3），任选皆可过检；
   建议实现时与 P2 同用 Y.Map 保持一致。非阻断。
3. **SA4 复核清单移交项**（设计已自列，此处确认充分）：复制集逐函数对账（出处标记）、P1/P2 期望核对、透传
   message 非空、`noUncheckedIndexedAccess` 收窄。SA7 复核 root typecheck/test 全绿含 pins。
4. **P2 的 Y.Map 插入序依赖**：打乱锚假设 Yjs `keys()` 按本地插入序枚举（本地构造 doc 成立，契约 fixture
   同假设族）；若未来引擎变化，P2 期望值冲突走 §12 末段退回纪律，不损设计。
5. **无需重开 ADR 冲突检查**：本轮修订 = 验收充分性 + 三处文本钉死，钉死语义零改动，SA8 iteration 3 已 clear
   设计层；实现轮复查义务（§15 清单）不变。`requiresConflictRecheck = false`。

---

## 附：结论摘要

iteration 1 修订完整、准确、克制：SA2-F1 的修复不是把「可选」改成「必选」的一句话，而是给出了含文件纪律
（独立绑定/内联 fixture/红因统一）、八个锚点规格、期望值（本轮全部独立重算无误）、杀伤面与冲突处理纪律的
完整验收设计；F2/F3/F4 的事实性修订经本轮源码独立复核全部属实。设计在需求覆盖、Owner 范围纪律、SA6/SA8
对账、架构归属、文件范围、验收设计六个维度均可安全实施。无 BLOCKER、无 MAJOR；两条非阻断观察移交实现/
复核轮酌情处理。

Verdict: **approve**（0 BLOCKER / 0 MAJOR / 2 新非阻断观察；iteration 0 的 1 MAJOR + 3 MINOR 全部销项）
