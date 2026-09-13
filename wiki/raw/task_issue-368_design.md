# 设计 — Issue #368 W1：`@nomicore/doc-runtime` 载体级窗口原语（ADR 0028 缝 1）

- 任务类型：**feature**（能力缺口：载体级确定性选窗原语整体不存在）
- Worktree / 基线：`/home/wangjian/nomicore-fix-issue-368`，branch `mabf/issue-368`，HEAD `36a73bb`
  （`docs(adr): ADR 0028 窗口读——readArray/readMap 确定性选窗（设计基线）`；tracked 文件零改动）
- 输入（全部实读）：任务简报 `wiki/raw/task_issue-368.md`；SA6 契约 `wiki/raw/task_issue-368_sa6_contract.md`
  （verdict **approve**，红灯契约 `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts`，
  39 红 + 6 绿负控）；SA8 iteration 1 `wiki/raw/task_issue-368_conflict_report.md`（reject，唯一阻塞 = 时序）；
  SA8 iteration 2 `wiki/raw/task_issue-368_conflict_report_iter2.md`（**clear**，Owner scoped override 实证）；
  SA8 iteration 3 `wiki/raw/task_issue-368_design_conflict_report.md`（设计层复查 **clear**：D3/D4/D8 裁为
  解释/空白填充，实现轮逐项核对）；**SA2 评审 `wiki/raw/task_issue-368_sa2_review.md`（verdict reject：
  1 MAJOR = SA2-F1 两处承重失败语义零可执行锚；3 MINOR = F2/F3/F4）**；决策摘录
  `wiki/raw/task_issue-368_relevant_decisions.md`；`docs/adr/0028-window-read.md`、
  `docs/adr/0024-readdata-shape-budget.md`、`docs/adr/0016`/`docs/adr/0008`（经摘录核对）；
  `packages/doc-runtime/AGENTS.md`；源码 `packages/doc-runtime/src/{index,read,carrier}.ts`；测试
  `packages/doc-runtime/test/*`（含公共面守卫两件与 SA6 契约文件 816 行全文）；`vitest.config.ts`；
  `packages/doc-runtime/tsconfig.json`（`test/**/*.ts` 在 include 内）。
- 本轮为**评审修订轮（iteration 1）**：原设计（iteration 0）存在，按 SA2-F1…F4 原位修订——核心变更 =
  **两处承重失败语义（D8 透传防静默跳项、D4 non-finite 归尾）从「设计记录锚定」升格为「设计记录 + 必选
  可执行锚」双重锚定**（D12 钉死项测试文件升格必选）；其余为 F2 身份锚比较器钉死、F3 调用方矩阵标签
  修正、F4 复制集名目补全（见 §14 逐条映射）。全部钉死语义（D3/D4/D5/D6/D7/D8）本身零改动。
- 本设计只做架构与实现设计；不实现、不运行测试、不提交。

---

## 1. 任务类型、目标和非目标

**目标（W1 / seam-1 全部验收面，Owner override 正向清单 + SA2-F1 验收充分性修复）**

1. `@nomicore/doc-runtime` 新增两个公共值导出（载体级窗口原语，`readLogicalValueAtPath` 姊妹、schema 无关）：
   - `readArrayWindowAtPath(doc, path, options?)` —— 序列容器窗口（Y.Array + plain array）；
   - `readMapWindowAtPath(doc, path, options?)` —— 键容器窗口（Y.Map + plain object）；
2. 确定性选窗：类型组总序（number → string → 不可比尾组）× dir（只翻转组内序）× 平局锚（key/下标 asc 恒定，
   锚比较器 = D10 码点比较器）；
3. 统一条目列表（`{index,value}` / `{key,value}`，身份随行、呈现序 = 有序基之序、值不含容器壳、空容器 → `[]`）；
4. 组合式 depth：每入选项物化 ≡ 同预算逐项 `readLogicalValueAtPath`（逐字节一致）；`maxChildrenPerNode`
   只治理入选项内部，终点宽度由 `n` 治理；
5. 零物化：未入选子项零递归零值读取（行为哨兵：毒值必须 `ok:true`）；
6. 三失败码响亮不抛：`WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID`
   （语义见 §9；另有一个非窗口域的投影失败透传成员，见 D8）；
7. 敌意 options/orderBy 封闭数据形状校验：零外抛、零 accessor 执行；
8. 纯加法：公共面守卫测试逐新导出记账；既有 674 用例与 root `pnpm typecheck` / `pnpm test` 保持绿；
9. **【SA2-F1 落实】钉死项可执行锚（必选，非可选）**：`packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts`
   承载 D8「`PATH_NOT_ALLOWED` 透传、绝不静默跳过失败项（fail-fast、无半窗）」与 D4「NaN/+Infinity/-Infinity
   排序键确定性归不可比尾组」两处承重失败语义的可执行锚（P1/P2 = SA2-F1 阻断最小集），并同文件必选承载
   P2b–P8（D12 规格）；实现前红于入口存在性、实现后绿、被 root `pnpm test` 采集。

**非目标（Owner override 负向清单 + SA6 §12.5）**

- W2（#369）：lease 层 `readArray`/`readMap` 公共面、四键 `{ok,value,schema,truncated}` 结算、`kept n/total N`
  与 ✂ 段事实、registry 透传、类型别名——**零涉及**；
- W3（#370）：schema 通道（元素口径投影文本、ADR-0027 T1/T2 依赖）、lease 生命周期相关面——**零涉及**；
- `packages/namespace-runtime` / `packages/namespace-registry` / `packages/vfsl` 及 wire、持久化、诊断日志：**零接触**；
- 文档面：**零改动**（override 路径零文档改动，SA8 iteration 1 §8-1/§6-2 已裁；ADR 0028 与 CONTEXT「窗口读」
  词条已在分支基线 `36a73bb`）。本设计的语义钉死项（D3/D4/D5/D6/D8）以**设计记录 + 必选 pins 可执行锚**
  双重锚定（SA8 iteration 1 注记 3 允许的两条路径之一 + SA2-F1 要求的可执行性），见 §13-R6；
- 不修改 `readLogicalValueAtPath` 签名/无 options 语义/options 闭合形状；不扩展 ValueSchema；不动 wire；
- pins 升格不扩 Owner 授权面：钉死项测试是「#368 全部验收面 + 纯加法」正向清单内的验收设计行为，
  零 schema / 零 W2 / 零 W3 面。

---

## 2. 当前行为与证据锚点

| # | 事实 | 锚点 |
|---|---|---|
| 2.1 | 姊妹读入口唯一：`readLogicalValueAtPath(doc, path)` 两参 → `ReadLogicalValueResult`（两键成功面）；三参 `options?` → 预算联合（四键成功面）。编排 G0 path 守卫 → OPT options 校验 → N0 `probeRoot` → N1 导航循环 → P1 投影；全程顶层 try/catch（E100 → `PATH_NOT_ALLOWED`） | `packages/doc-runtime/src/read.ts` L118–239 |
| 2.2 | 姊妹缺席吸收（D4/E1）：Y.Map/plain object 缺键、数组越界 → `{ok:true, value:undefined}`；数组在界 undefined/稀疏空洞 → 响亮 `PATH_NOT_ALLOWED` | read.ts L168/L174/L190–191；NC1/NC5 实测锚 |
| 2.3 | 姊妹 options 封闭形状（ADR-0024 冻结）：仅 `depth`/`maxChildrenPerNode`；未知键、accessor、非 plain 宿主、非有限非负整数 → `READ_OPTIONS_INVALID`；校验零 doc 触碰、零外抛、零 accessor 执行（V1–V3） | read.ts L326–361；NC2/NC3 实测锚 |
| 2.4 | 投影纪律：plain 域 JSON 值域（non-finite/bigint/空洞/嵌套 Yjs/非 plain 原型 → 响亮失败）；输出键 `putKey` defineProperty 四真（`__proto__` 自有键安全）；预算折叠 `budgetFold`（depth:0 同形空壳）与零物化边界（超出保留前缀零 get）；detached Yjs 载体拒绝静默空投影 | read.ts L714–800、L805–810、L583–597、L642/L676/L747、L550 |
| 2.5 | 载体判定 `carrierOf`（五值词汇表）与 `probeRoot`（只碰 'ROOT'，缺席惰性创建空 Y.Map、零 update 事件）为**已导出**的模块内部件（`./carrier.js`） | `packages/doc-runtime/src/carrier.ts` L26–38、L53–70 |
| 2.6 | 公共面现状：9 枚值导出 + 类型导出（`src/index.ts` 全文）；零 `window\|orderBy\|WINDOW_` 命中（SA6 §5 探针：两绑定名 `undefined`） | `packages/doc-runtime/src/index.ts` L13–44；SA6 契约 §5 |
| 2.7 | 公共面纪律：新导出仅经 `src/index.ts`；守卫测试逐导出记账；公共类型变更须跑 root `pnpm typecheck`/`pnpm test` | `packages/doc-runtime/AGENTS.md` Boundaries/Verification |
| 2.8 | 守卫测试现状：`public-surface-guard.test.ts`（值面：applyValidatedMutation 专项 + owner 五导出 + MUTATION_GUARD_MISMATCH）；`public-surface-type-guard.test-d.ts`（类型面：正例 import + `@ts-expect-error` 负例）；`doc-runtime-surface.test.ts`（declaration emit 存在性审计，无穷举键集断言——加法安全） | 三文件实读 |
| 2.9 | 测试基线：doc-runtime 32 文件 / 674 用例全绿 + SA6 契约文件（45 用例：39 红 / 6 绿）；root `pnpm test` 379 文件 4429 用例，唯一红 = 契约组预期红灯；root `pnpm typecheck` exit 0 | SA6 契约 §4/§13 |
| 2.10 | tsconfig 纪律：`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`verbatimModuleSyntax`、`isolatedModules`；`packages/doc-runtime/tsconfig.json` include 含 `test/**/*.ts`（新测试文件被包级 tsc 类型检查） | `tsconfig.base.json`；`packages/doc-runtime/tsconfig.json` |
| 2.11 | 测试采集面：root `vitest.config.ts` runtime include `packages/*/test/**/*.test.ts`（L15）采集拟议 pins 文件路径；typecheck include 仅 `*.test-d.ts`（L20）。**载体层事实探针（本轮只读 node 探测，未落盘）**：(a) Y.Map 显式 `undefined` 值键可构造（`set('u',undefined)` 后 `keys()` 含 'u'、`get('u')===undefined`）；(b) detached Y.Map 可从 ROOT 经 plain holder 导航到达（`root.set('holder',{inner:new Y.Map()})` → `['holder','inner']` 命中 `doc===null` 的 YMap）——P4/P6 fixture 可建（D12） | `vitest.config.ts` L15/L20；本轮探针（见 D12） |

---

## 3. 根因 / 能力缺口（承接 SA6 §8 能力缺口链）

最深根因：**选窗能力从未作为独立公共面交付**——ADR 0028 已接受设计（决策 2/3/4/5/7/8/9-子弹 1 逐条对应任务实质），
但实现排期被 ADR-0027 时序条款挡住；Owner scoped override（评论 5652697060）已合法化 seam-1 提前开工。
现状放大因素：无窗口面时调用方只能全量物化再自行裁剪（失去零物化成本纪律与确定性总序）。
本设计不重复复现（SA6 已稳定复现 39 红/三轮、负控 6 绿、退化策略差分表 §9-4）；设计响应 = §7/§8 的接口与算法
+ §7-D12 的钉死项可执行锚（SA2-F1 指出的验收设计缺口：D8/D4 两处承重失败语义原无可执行锚，错误路径可伪绿）。

---

## 4. Owner要求落实

适用评论：**5652697060**（`welltop-jim-wang`，`author_association: OWNER`，created = updated =
`2026-09-13T10:24:57Z`，issue #368 唯一评论；SA8 iteration 2 §2 与 iteration 3 §2 REST 双重复证，零编辑）。
Issue 正文（10:09:45Z 快照）与简报逐字节一致（iteration 2 §2「范围未扩大」行）。

| Comment ID | Updated at | Requirement | Design section |
|---|---|---|---|
| 5652697060 | 2026-09-13T10:24:57Z | 覆盖 #368 全部验收面（载体级选窗原语、条目列表、排序总序、零物化哨兵、三失败码、敌意 options 校验） | §7 D1–D11、§8 接口与算法、§9 失败语义、§12 验收映射（AC1–AC5 ↔ 契约组 A–H + 必选 pins P1–P8） |
| 同上 | 同上 | 「纯加法、schema 无关」 | §1 非目标（不触 schema 通道/lease 四键结算）、§11 DENY LIST（read.ts/namespace-*/vfsl）、D2（read.ts 零 diff）；pins 升格 = 纯测试加法（§1 目标 9 注） |
| 同上 | 同上 | 「开工与合入（挂 Parent PR #367）」豁免 ADR-0027 时序门禁 | 本设计即为 seam-1 开工产物；PR/合入操作归 Host/Controller（本角色禁止） |
| 同上 | 同上 | 不覆盖 #369（W2 lease 公共面）及以后（schema 通道依赖 #363/#364） | §1 非目标、§11 DENY LIST（namespace-runtime/namespace-registry）、D9（截断事实延后 W2） |
| 同上 | 同上 | 不覆盖 #370（W3） | §1 非目标、§11 DENY LIST |

最新 Owner 评论与旧设计冲突：不适用（iteration 0 设计即按该评论新建；本轮修订未触碰范围面——SA2-F1 属
验收设计充分性，非范围扩大）。

---

## 5. 复现和根因承接

| 上游事实 | 证据位置 | 设计响应 |
|---|---|---|
| 能力缺口稳定可证：公共面 9 导出零窗口命中、两绑定名 `undefined`；包源码零窗口面 | SA6 契约 §5-1/§5-2（tsx 探针 + grep，实跑） | §8 新增公共面（两个值导出 + 类型导出），D1 冻结绑定 = 契约默认 → **契约测试文件零改动**（SA6 §12.7-4 只在改绑时动 §绑定 常量） |
| 红灯 39 条全部 = 「入口未导出」能力缺失断言；零 fixture/环境/超时/入口错误 | SA6 契约 §13（红因逐条核验，`grep -v "W1 能力缺口"` 残项 0） | 实现后 39 红 → 绿是唯一验收口径（§12）；不为过契约改语义断言（§11 DENY：契约文件） |
| 负控 6 条全绿且证明哨兵有牙（NC5：毒值经姊妹全量物化必 `PATH_NOT_ALLOWED`） | SA6 契约 §6/§13 | D6/D7 保持姊妹语义逐字不变（read.ts 零 diff）；F 组 `ok:true` 只有真零物化才可能成立 |
| 退化策略差分表（不排序/整体倒序/平局翻转/码元序/全量物化再裁剪/误用宽度轴/缺席吸收混淆） | SA6 契约 §9-4 | §8 算法逐项反制：全量分类排序（非前缀直出）、组间序恒定 + dir 仅组内翻转、平局锚恒 asc、码点比较器（D10）、只物化 min(n,total) 项（D7）、终点宽度由 n 治理（D9）、缺席响亮（D7） |
| 等价锚对账基 = `readLogicalValueAtPath(项路径, 同 options)`（SA8 注记 4） | SA8 iteration 1 注记 4；契约 E 组 `expectEquivalence` | D7：**逐项物化按字面调用公共姊妹**（预算轴原样透传或缺席两参调用）——等价锚由构造保证；**其盲区（被跳条目不可见）由必选 pins P1 封堵**（SA2 ER2：E 组只对已返回条目对账） |
| non-finite 排序组归属为决策文本空白，SA8 移交 SA1 钉死 | SA8 iteration 1 注记 3 / §8-5；SA6 §15-2 | D4 钉死：全部 non-finite（NaN/±Infinity）排序键归不可比尾组（详见 D4 论证）；**可执行锚 = 必选 pins P2/P2b（D12，SA2-F1）**——归 number 组 / 尾组随 dir 翻转 / 锚用插入序的退化实现必红 |
| 设计自由项：绑定名 / orderBy 单复数 / 结算键集 / 空路径 / field 点号 / plain object 键空间边角 | SA6 §12.1、§15-1/3/4/5/6 | D1（绑定冻结）、D1/B-5（结算最小两键 + **P7 own 键集锚**）、D5（field 单段字面语义 + **P3 锚**）、D7（空路径接受 + **P5 锚**）、D6（键空间 = 姊妹 D5 纪律 + **P4 锚**） |

上游事实与源码矛盾：**未发现**。一处**上游文本内部张力**（ADR 0028 决策 2 注释「asc = 自 [0] 取」 vs
已验收契约 A 组的值键排序）已由 SA8 iteration 3 #2 裁为 no-conflict（解释性钉死）+ SA2 §6 独立重算互证；
设计以 D3 钉死并调和。SA2 §5 指出的「D8/D4 零可执行锚」为**验收设计缺口**（非源码矛盾），由 D12 落实。

---

## 6. SA8约束落实

| 决议或义务 | 设计位置 | 处理方式 | 是否需要设计后冲突复查 |
|---|---|---|---|
| 裁决 override-authorized（iteration 2 §3/§4/§6，verdict clear） | 全文 | 取证范围锁定 seam-1；§1 非目标排除 W2/W3；§11 DENY LIST 机器可查 | 否（已裁；范围越界才触发 iteration 2 §7-3） |
| 设计层复查 clear（iteration 3：D3/D4/D8 = 解释/空白填充，0 hard-conflict / 0 evolution-required；override 范围复证未扩大） | 全文 + §15 | 承接裁定；本轮修订（pins 升格 + 三处文本钉死）不触碰任何被裁语义——SA2 §14-5 确认 F1–F4 无新 ADR 冲突面 | 否（设计轮已 clear；实现轮义务见 §15） |
| 冻结面：`readLogicalValueAtPath` 三参签名与无 options 语义逐字不变 | D2、§11 DENY（read.ts） | read.ts **零 diff**；窗口逐项物化字面调用公共姊妹；D2 复制集名目 + 出处标记约定（SA2-F4）使漂移可检 | 实现后核对（iteration 2 §7-1） |
| 冻结面：readData options 闭合形状与 `READ_OPTIONS_INVALID` 家族零触碰 | D9、§11 DENY | 窗口 options 是**新独立形状**（n/orderBy/depth/maxChildrenPerNode），不复用不改姊妹校验；NC2 锚定 | 实现后核对 |
| 冻结面：ValueSchema 9-kind / wire 表面零接触 | §1 非目标 | 条目列表是传输形态；零 schema/wire 文件接触 | 否 |
| 冻结面：ADR 0028 v1 词表（WindowTerm 闭合联合、条目两形、总序、三码名、n≥1、零物化、成本界） | D1（B-4 单 term）、§8 类型、D3/D4（总序钉死）、§9（三码名逐字）、D7（n≥1）、D6/D7（零物化）、§8 成本 | 逐条实现；两处决策文本空白由 D3/D4 钉死（**设计记录 + 必选 pins 可执行锚**，D12） | 实现后核对（iteration 3 §8-1 承继） |
| 冻结面：doc-runtime 公共面纪律（新导出仅经 `src/index.ts`，守卫测试逐导出记账） | D2、§11 ALLOW（index.ts + 两守卫测试） | 两值导出 + 类型导出只经 index.ts；守卫测试加法扩展（SA6 §10 明示属「纯加法」允许范围） | 实现后核对 |
| 冻结面：`WINDOW_TARGET_ABSENT` 不吸收语义只属窗口原语，不得回渗姊妹 E1 吸收 | D7（窗口导航缺席 → ABSENT；姊妹不动） | 分歧双向锁定：窗口响亮（G1）↔ 姊妹吸收（NC1）成对 | 实现后核对 |
| 红线：语境外排序项响亮拒绝（readArray 传 field/'key'、readMap 传 'index'、多段 field） | §8 options 校验（face 词表） | `WINDOW_OPTIONS_INVALID`（G4） | 否（按文实现） |
| 红线：等价锚对账基 = `readLogicalValueAtPath(项路径, 同 options)` | D7 | 逐项物化字面调用公共姊妹 | 否 |
| 移交 SA1：注记 3 non-finite 排序边角钉死（「不得实现期临场发明」） | D4 + **D12-P2/P2b** | 归不可比尾组；设计记录 + **必选可执行锚**双锚定（不改 ADR/CONTEXT，理由见 §13-R6） | 实现轮核对钉死项与实现一致（iteration 3 §8-2） |
| iteration 3 §8-6 建议：pins 落地使 D3/D4/D5/D6/D7/D8 钉死项可执行 | D12 | **采纳并升格为必选**（SA2-F1）；D3 由契约 A 组已锚定，不设重复专锚 | 否 |

---

## 7. 设计决策与主要备选方案

### D1 契约绑定冻结（SA6 §12.1 B-1…B-5，全部取契约默认值）

| # | 绑定 | 冻结值 | 理由 |
|---|---|---|---|
| B-1 | 数组窗口公共值导出 | `readArrayWindowAtPath` | 遵循 `readLogicalValueAtPath` 命名族（read + 语义 + AtPath）；自文档载体面；不预占 W2 lease 层 `readArray`/`readMap` 名（ADR 0028 决策 1 属 lease 层）。**与契约默认一致 → 契约测试文件零改动** |
| B-2 | 键容器窗口公共值导出 | `readMapWindowAtPath` | 同上 |
| B-3 | 调用形状 | `(doc: Y.Doc, path: readonly (string\|number)[], options?)`；`options = { n, orderBy?, depth?, maxChildrenPerNode? }`；`n` 必填 ≥1 有限整数 | 姊妹三参同构；ADR 0028 决策 1 词表的载体层同形（SA6 B-3 依据） |
| B-4 | `orderBy` 形态 | **单个 WindowTerm 对象**（非列表） | ADR 0028 决策 2 `type WindowTerm` 单对象 + 「多字段演进 = orderBy 变项列表，零形状变化」——v1 冻结单对象，演进位保留；契约 G5 断言列表非法，一致 |
| B-5 | 结算形态 | 成功 `{ok:true, value:<条目列表>}` 恰两键（own 键集）；失败 `{ok:false, code, path, message}`（契约只锁 ok/code；path = 实参新鲜回显副本、message 恒非空——沿姊妹失败惯例，见 read.ts L248–261）。own 键集自诺由 **pins P7 锁死**（D12） | 见 D9（不带截断事实）；额外字段允许但 v1 不加 |

**备选（否决）**：单入口 + 模式参数（`readWindowAtPath(doc, path, {face:'array'|'map', …})`）——SA6 §15-1
允许但需新增适配器并重绑两条入口；ADR 0028 备选节已否决「单 API」方向（拆分后词表更窄、载体不符响亮、
名字自文档），且契约默认绑定即两入口。**备选（否决）**：`orderBy` 冻结为单元素列表——与 ADR 决策 2
单对象词表冲突，且 G5 把列表列为非法形状。

### D2 模块放置与复用策略：新文件 `src/window.ts`，`read.ts` 零 diff

- 新模块 `packages/doc-runtime/src/window.ts` 承载两个入口与全部窗口私有逻辑；
- `import { carrierOf, probeRoot } from './carrier.js'`（已导出，零改动）；
- `import { readLogicalValueAtPath } from './read.js'`——**逐项物化按字面调用公共姊妹**（D7）；
- 窗口自有导航循环（缺席语义不同，见 D7）与本地助手，从 read.ts **复制**（复制集全名目见下表；
  SA2-F4 补全），不导出；
- **read.ts 零字节改动**（SA6 §10 红线「read.ts 零改动」的最严格读法）：既不输出内部助手、也不抽取共享模块
  （抽取需移动 read.ts 函数体，威胁「无 options 逐字节现行为」冻结面与 674 用例基线）。

**复制集名目（SA2-F4；行号 = 本轮 grep 实核，read.ts 模块私有件）与出处标记约定**：

| 复制件 | read.ts 锚 | 窗口侧用途 |
|---|---|---|
| `isPlainRecord` | L405 | plain object/宿主判定（键面载体检查、options/orderBy 校验） |
| `readableOwnDataValue` | L481 | plain object child 单段下钻（D5）/键空间（D6）——descriptor 读、零 accessor 执行 |
| `readableArrayElement` | L497 | plain array 元素 descriptor 读（D6 条目空间；稀疏/undefined 边角） |
| `isNonNegInt` | L382 | 段型守卫（导航 C1）与 `n`/预算轴整数判定 |
| `segMsg` | L387 | 导航失败 message 构造（C1/C2/C3 同款可诊断文本） |
| `yjsWord` | L392 | Yjs 载体命名词（detached/unknownShared 失败文本） |
| `navClassify` 等价 switch（含 detached 前置判别） | L436–470 | 导航循环载体分类（ymap/yarray/plainObj/plainArr/scalar/xml/text/detached/unknownShared）——**唯一分歧位 = 缺席改判 `WINDOW_TARGET_ABSENT`**（D7），分类与纪律分支逐字镜像 |
| `safeDetail` / `safeSpreadPath` | L277 / L259 | 顶层 try/catch（E100 镜像）收编：绝不二次抛、path 回显副本 |
| 码点迭代比较器（D10） | read.ts 无此件（**新建**） | string 组排序键 + 身份锚（键面）共用 |

出处标记约定：每个复制函数头注释一律 `// copied from read.ts@36a73bb (<原名>) —— read.ts 零 diff 红线下复制；read.ts 冻结解除时逐函数对账`。
**follow-up 登记（§13）**：read.ts 冻结解除（ADR-0028 后续修订或 W2+ 触碰）时评估抽共享模块消复制。

**备选（否决）**：向 read.ts 内部助手加 `export` 供窗口复用——read.ts 出现 diff，违反零改动红线且扩大模块
导入面。**备选（否决）**：抽取 `read-shared.ts` 共享助手——read.ts 大 diff + 回归风险，收益仅省 ~100 行复制。

### D3 【钉死项·解释性】数组面 `by:'index'` 的操作语义 = 值键总序 + 下标 asc 锚

**张力**：ADR 0028 决策 2 注释「`{ by: 'index'; dir? } // readArray 专属；缺省即此（asc = 自 [0] 取）」与
CONTEXT「窗口读」词条同句；而已验收契约的数组面用例（A1–A8）断言的是**按项值排序**：

- A1（缺省无 orderBy，n:9）期望下标序 `[1,0,2,4,3,5,6,7,8]` = 值序（1<5<30 → 'A'<'b' → true/null/{z:1}/[7] 尾组），
  而非 `[0..8]`；
- A2（`{by:'index', dir:'desc'}`）期望 `[2,0,1,3,4,5,6,7,8]` = 值序 desc（组间序不变、尾组锚不变），而非整体倒序；
- A7 字符串码点序断言出现在**数组面**；A3「两方向都先装可比项」、A4「尾组 [5,6,7,8] 两方向一致」均以值分组为前提；
- SA6 §9-4 退化策略表把「不排序（插入序/下标序直出）」列为**必须红**的退化实现（A1/A3/A4 命中）——契约立场是
  刻意的，非笔误；
- 任务简报自身佐证：行为要点「排序总序」段含「平局按 key/**下标** asc 恒定」（数组面平局只有在值键排序下才会
  发生：索引互异，纯索引序永无平局）；AC1 矩阵「基 × dir × 类型组序 × 不可比尾组 × 平局稳定锚」要求类型组机制
  在数组面可测。

**钉死（W1 操作语义）**：数组面（缺省或显式 `by:'index'`）的排序键 = **项值本身**，按类型组总序
（有限 number 数值序 → string 码点序 → 不可比尾组）排列；**平局（含整个不可比组）按下标 asc 恒定锚定**；
`dir` 只翻转可比组内值序，组间序与锚不翻转；窗口 = 有序基前 `min(n,total)` 项。值键中的 non-finite 归组由
D4 钉死（**可执行锚 = pins P2b**）；数组面身份是数值下标，天然全序，无需字符串比较器。

**与「asc = 自 [0] 取」的调和**（两条同收敛的读法，均与本语义一致）：

1. **前缀读法（主）**：决策 5 明文「窗口是序列前 n 前缀」；「自 [0] 取」= 自**有序基**的第 [0] 位取（asc 方向取
   有序基头部；desc 取 desc 有序基头部），`[0]` 指窗口起点而非容器下标；
2. **退化读法（辅）**：当值序无法区分（全部平局/全部不可比——如 append 日志全为容器记录项）时，有序基退化为
   下标序，恰为「自容器 [0] 取」。

**可执行锚**：契约 A1–A8（已验收，纯索引/整体倒序/锚翻转读法直接红）。**备选（否决）**：纯索引读法
（asc = 容器前 n、desc = 尾 n）——直接红 A1/A2/A3/A4/A7（已验收契约不可过），且使决策 5 的数组面锚与
AC1 矩阵空转；SA8 iteration 3 #2 已裁 no-conflict、SA2 §6 独立重算互证。若 Owner/SA2 后续改采纯索引读法，
按 iteration 3 §8-4 路径处理（改契约 A 组 + 实现 + 重开复查）。

### D4 【钉死项·SA8 注记 3】non-finite 排序键归不可比尾组（可执行锚 = P2/P2b）

`field` 基单段下钻（以及 D3 值键分类）可能读到 NaN/±Infinity（Yjs 载体可持有非有限数；物化侧才会响亮拒绝）。
决策 5 的不可比组枚举「缺失/null/布尔/容器」未点名 non-finite。

**钉死**：排序键分类的 number 组成员资格用 **`Number.isFinite`** 判定——NaN、-Infinity、+Infinity 一律归
**不可比尾组**，组内按身份（key/下标）asc 恒定锚定，组位不随 dir 改变。

论证：

1. **总序确定性（决策 5 核心）是绝对要求**：NaN 与任何数值比较均为 false，任何依赖数值比较器的分组内排序都会
   产生不一致序（引擎依赖）——破坏「同一数据同一窗口」；
2. **尾组立法目的同构**：决策 5「缺字段的脏项永远不挤掉正常项」——non-finite 排序键是脏数据，归尾保证两个方向
   都先装可比项；
3. **包内纪律统一**：物化侧对 non-finite 家族统一处理（read.ts `copyPlainStrict` 的 `Number.isFinite` 拆支，
   L723–726）；排序分类侧同款单规则，不引入「Infinity 在 number 组、NaN 在尾组」的分裂规则（分裂规则可论证但
   难文档、难测试，且 +Infinity 会挤掉正常项 asc 窗口，违背目的 2）；
4. **零物化兼容**：分类只做 typeof/`Number.isFinite` 级原始读，不物化——non-finite 在**未入选**子树内时连同
   整个子树零读取（F 组哨兵不变）；在**入选项**内部时由逐项姊妹物化按现行纪律响亮失败（D8 透传）。

**可执行锚（SA2-F1 阻断最小集之二）**：pins **P2**（field 基：score 为 NaN/-Infinity/+Infinity 的 child 全落
不可比尾组、组内键 asc、asc/desc 两方向组位不变、**插入序打乱使锚可区分**）+ **P2b**（数组面值键 non-finite
归尾）。杀伤面：±Infinity 归 number 组（asc 首位变 -Inf 项 / desc 首位变 +Inf 项）、NaN 进 number 组
（位次引擎依赖地漂移）、尾组随 dir 翻转、尾组锚用插入序——全部红。

**备选（否决）**：±Infinity 归 number 组（数值序良定义）——分裂规则 + 脏项挤位；**备选（否决）**：non-finite
排序键响亮失败——把「选窗」变成「数据卫生检查」，且 F3（毒值在非排序字段）已排除整项物化，排序键侧再失败
无必要。契约对排序键 non-finite 无断言（SA6 §15-2）——**本钉死以设计记录 + 必选 pins 双锚定**，不改
ADR/CONTEXT（§13-R6）。

### D5 【钉死项】`field` 语义：单段字面键，点号不拆分（可执行锚 = P3）

- `field` 值必须是 `string`（`typeof === 'string'`）；非字符串（含数组 `['a','b']`）→ `WINDOW_OPTIONS_INVALID`
  （G4 锚定）；
- 字符串值是**单段字面键**：含点号的 `field`（如 `'a.b'`）寻址 child 自身名为 `'a.b'` 的键——沿姊妹 D3 段纪律
  「段从不拆分、从不解释，点号/空格是合法键名」（read.ts L16–17）；空串 `''` 同为合法键名（通常未命中 → 缺失 →
  尾组）；
- 下钻 = 每 child **恰一次单段原始读**（决策 8）：Y.Map child 用 `get(field)`；plain object child 用
  `readableOwnDataValue` 同款 descriptor 读（零 accessor 执行）；child 非键容器（标量/Y.Array/plain array/
  XmlFragment/非 plain 对象）→ 字段不可解析 ≡ 缺失 → 尾组；detached Yjs child → 零触碰归尾组（沿 `budgetFold`
  B16「detached 零 count 读」先例），若该项入选则物化期由姊妹 detached 守卫响亮失败；
- 读到的原始值即排序键（进 D4 分类）；**绝不对 child 整项物化**（F3 锚定：毒值在非排序字段不得被触及）。

**可执行锚**：pins **P3**——(a) `field:'a.b'` 字面寻址：child 自有键 `'a.b'` 命中、仅含 `'a':{b:7}` 的 child
归尾组（点号拆分实现把后者钻到 7 → 序列首位即差异 → 红）；(b) `field:''` 空串字面键命中 `{'':5}` child
（锁「空串是合法键名」）。

### D6 【钉死项】条目空间（entry space）与键空间纪律（可执行锚 = P4）

- **数组面**：候选 = 目标容器全部下标 `0..len-1`。Y.Array：`get(i)` 原始读（attached 公共路径不可达 undefined，
  防御分支见 D8）；plain array：descriptor 纪律读——稀疏空洞/在界 undefined/accessor 下标**不读值、归不可比
  尾组**（零物化哨兵哲学：不可表示 ≠ 选窗失败；入选后物化由姊妹按现行纪律响亮处理）；
- **键面**：Y.Map 候选 = `keys()` 中 `get(k) !== undefined` 的键（**显式 undefined 值键排除**——与姊妹 E1 吸收
  同构，保证 Y.Map ↔ plain object 载体同构（A6/B3 要求）不因 undefined 值键破裂：plain object 的 undefined 值
  键本就在 `readableOwnDataValue` 键空间外）；plain object 候选 = own enumerable **data** 键且值非 undefined
  （姊妹 D5 键空间，read.ts L481–491：accessor/non-enumerable/原型链/symbol 键一律键空间外，零 accessor 执行）；
- 排序键读取一律**原始值读**（typeof/carrierOf/`Number.isFinite` 级），绝非投影；深子树零读取；
- 条目输出对象 `{index,value}` / `{key,value}` 以字面量构造（属性名是固定字面量，敌意键是**属性值**而非属性名，
  无污染面——D5 测试锚定 `Object.getPrototypeOf(e) === Object.prototype`）；条目 `value` 来自姊妹读（其内部
  `putKey` 纪律已防 `__proto__` 自有键劫持，read.ts L805–810）。

**可执行锚**：pins **P4**——Y.Map 显式 `set('u', undefined)` 值键与 plain object `{u: undefined}` 值键均**不在
条目空间**（本轮探针实证 Y.Map 可构造显式 undefined 值键：keys 含 'u'、get === undefined，§2.11）；键基窗口
条目恰为非 undefined 值键。

### D7 导航、缺席与逐项物化（空路径/detached 可执行锚 = P5/P6）

定序（镜像姊妹 G0 → OPT → N0 → N1，read.ts L132–239）：

1. **G0** path 形态守卫：非数组 path → `{ok:false, code:'PATH_NOT_ALLOWED', path:[], message:'DOCRT-E100…'}`
   （姊妹镜像；契约未测，钉死项）；
2. **OPT** options/orderBy 校验（D9/§8 校验规格）：非法 → `WINDOW_OPTIONS_INVALID`，**零 doc 触碰**（V2 镜像）；
3. **N0** `probeRoot(doc)`：ROOT 非 Y.Map → `PATH_NOT_ALLOWED`（C4 镜像；契约未测，钉死项）；fresh doc 的 ROOT
   惰性创建为空 Y.Map（零 update 事件，carrier.ts P4）；
4. **N1** 导航循环：**段纪律/载体分类/失败分类全部沿用姊妹**（C1 段型不符、C2 不可下钻终态、C3 值域违规、
   detached 响亮、R2 #2——一律 `PATH_NOT_ALLOWED`），**唯一分歧**：姊妹的 D4 缺席吸收位（Y.Map/plain object
   缺键、数组越界）→ 窗口改判 `WINDOW_TARGET_ABSENT`（响亮，不吸收——G1 四路径锚定：`['missing']`、
   `['obj','missing']`、`['plainObj','missing']`、`['arr',99,'x']`）；
5. **空路径 `[]`**（钉死项，契约未测）：接受——目标 = ROOT 自身（Y.Map）；键面 → ROOT 窗口（fresh doc → `[]`），
   数组面 → ROOT 是 Y.Map → `WINDOW_CARRIER_MISMATCH`。与姊妹 `[]` 行为同构（姊妹投影 ROOT 为普通对象）；
6. **C 载体面检查**（导航耗尽）：数组面收 attached Y.Array / plain array；键面收 attached Y.Map / plain object
   （`isPlainRecord`）。命中 → 枚举；detached Y.Array/Y.Map → `PATH_NOT_ALLOWED`（面符但不可读——非缺席、非
   不符、非非法；姊妹 detached 纪律同判）；其余（标量/string/bool/null/XmlFragment/Y.Text/未知 shared/非 plain
   对象/plain array（对键面）/plain object（对数组面））→ `WINDOW_CARRIER_MISMATCH`（G2 全枚举锚定）；
7. **E/S 枚举 + 分类 + 排序**（D3/D4/D5/D6）：O(N) 候选枚举与原始键分类；全量确定性排序（比较器完全序：
   组序（恒定）→ 组内值序（dir 敏感）→ 身份 asc 锚（恒定）——身份唯一故比较器为全序，不依赖
   `Array.prototype.sort` 稳定性，H1 确定性由构造成立）；窗口 = 前 `min(n, 候选数)` 项；
8. **M 逐项物化**：对每个入选项，`entry.value := readLogicalValueAtPath(doc, [...path, identity], B)`，其中
   `B` = 调用方 `depth`/`maxChildrenPerNode` 原样透传的预算对象（两轴均缺席 → 两参调用，legacy 语义）。
   `[...path, identity]` 逐项新鲜构造（不别名调用方数组）。**等价锚（E 组）由构造保证**：实现使用的物化通道
   与契约断言的对账基是同一个公共入口同一次调用形状；**任一项失败 → 整窗失败（fail-fast、无半窗、无静默
   跳项、不取下一项补位）**——D8 透传，**可执行锚 = pins P1/P6b**（E 组对已返回条目对账、被跳条目不可见——
   SA2 ER2 指出的伪绿通道由 P1 封堵）；
9. **A 装配**：成功 `{ok:true, value: <条目列表>}`（恰两键，P7 锚）；失败构造见 §9。

**可执行锚**：pins **P5**（空路径：fresh doc 键面 → `[]`；含键 ROOT → 键窗口；数组面 → MISMATCH）；
pins **P6**（detached：`['holder','inner']` 经 plain holder 到达 detached Y.Map → `PATH_NOT_ALLOWED`
而非 MISMATCH/ABSENT；P6b plain array 内 detached Y.Map 项入选 → 物化期同通道失败）。

**成本**：O(path) 导航 + O(N) 枚举与原始分类 + O(N log N) 比较器排序（仅原始键比较，零物化）+ field 基每 child
一次单段下钻 + O(min(n,N) × depth) 物化。决策 8 列举的 O(N) 枚举 / 单段下钻 / O(n×depth) 物化逐条满足；排序
成本 O(N log N) 为 v1 接受项（SA8 iteration 3 #8 已裁：决策 8 清单是成本下界义务枚举而非禁令）；
partial-selection（O(N log n) 有界堆）是零可观察差异的纯优化，登记 §13 follow-up，不进 v1。

### D8 【钉死项】投影失败的透传成员 `PATH_NOT_ALLOWED`（可执行锚 = P1）

三枚 `WINDOW_*` 码是**窗口域**失败词表（目标缺席 / 载体面不符 / 规则非法——issue 三失败码的精确语义）。
入选项物化失败（选中项内含 non-finite/稀疏空洞/bigint/Y.Text/非 plain 对象/detached 等投影不可表示值，或内部
E100）是**投影域**失败，已存在精确词表：姊妹的 `PATH_NOT_ALLOWED`（read.ts D8「一切预期失败与崩溃边界统一」）。

**钉死**：窗口顶层 try/catch（E100 镜像）与逐项物化失败一律透传为
`{ok:false, code:'PATH_NOT_ALLOWED', path:<项路径或实参路径的新鲜副本>, message}`（message 带 `DOCRT-E100`
前缀或姊妹原始 message、恒非空；失败同步、不抛）。**fail-fast：首个物化失败即整窗失败，无半窗泄漏、无静默
跳项、不以未选项补位**。

论证：(a) 响亮、零外抛、可诊断（path 精确到违规项）；(b) E 组等价锚的失败方向同构——项读会失败则窗口对该项
失败，码与路径一致；(c) 不静默跳项、不用哨兵值（禁 silent fallback）；(d) 契约 B-5 只对**已测三种模式**锁
ok/code，无任何用例断言「失败码只能是三码」（G8 只断言三码互异）；(e) 不发明第四个窗口码（避免 W2 lease 结算
面与词表膨胀）。SA8 iteration 3 #7 已裁 no-conflict（三码语义逐字保持；透传是空白处唯一不吞错读法）。

**可执行锚（SA2-F1 阻断最小集之一）**：pins **P1**——复用契约 `makeSentinelDoc` 的 field fixture（内联同构，
注明出处）：`field` = Y.Map{f1:{s:1}, f2:{s:2}, f3:{s:3,bad:NaN}}，`n:3` + `{field:'s'}` 全选（s 值 1/2/3 全为
有限 number）→ f3 物化必失败（NC5 fieldPoison 实证 `{s:3,bad:NaN}` 全量读 `ok:false`）→ 断言：同步不抛、
`ok:false`、`code === 'PATH_NOT_ALLOWED'`、失败联合不携带部分条目（无 value 半窗）、`path` 深等于
`['field','f3']`、`message` 非空。杀伤面：静默跳项（返回 f1/f2 两条 `ok:true`）、取下一项补位、吞错降级三码
（`WINDOW_CARRIER_MISMATCH`/`WINDOW_OPTIONS_INVALID` 冒充）——全部红。

**备选（否决）**：跳过失败项取下一项——静默吞错，违反 fail-loud（**P1 使其必红**）；**备选（否决）**：归入
`WINDOW_CARRIER_MISMATCH`——载体面并无不符，不诚实（P1 的 code 断言使其红）。

### D9 结算最小化与 options 校验规格（own 键集可执行锚 = P7）

- **成功面恰两键** `{ok:true, value}`：`kept = value.length` 可推导；`total`/`truncated`/`truncations` 是
  ADR 0028 决策 7 **lease 口径**四键结算的组成（W2 范围），doc-runtime 层不携带（SA6 §12.5 明示不锁、不断言）。
  v1 不加投机字段，避免预占 W2 冻结面；**备选（否决）**：附带 `kept/total`——为 W2 省一次 O(N) 枚举，但扩大
  本层冻结面且 W2 未定形，收益投机；
- **options 校验**（镜像 `validateReadOptions` 纪律，read.ts L326–361，全部内层 try 收编 Proxy trap，零外抛、
  零 accessor 执行、零变异）：
  - 宿主：非 null 对象 ∧ 非数组 ∧ 原型 ∈ {Object.prototype, null}，否则非法；
  - 键空间：own enumerable string 键 ⊆ {n, orderBy, depth, maxChildrenPerNode}，未知键非法；descriptor 缺失键
    忽略（敌意 ownKeys 谎报）；accessor 键非法且零执行；键在场值 undefined ≡ 缺席（R1 镜像）；
  - `n`（必填）：own data 值须 `typeof number ∧ Number.isInteger ∧ Number.isFinite ∧ ≥1`（窗口 n ≥1，异于预算
    轴 ≥0——G3 全枚举：缺失/0/-0/-1/1.5/NaN/+Inf/'2'/null 均非法；大整数如 1e21 合法 → `min(n,total)` 无害）；
  - `depth`/`maxChildrenPerNode`：姊妹轴语义原样（≥0 有限整数，-0 归一 0）；
  - `orderBy`（在场且值非 undefined 时）：宿主 plain 判定同上；键空间 ⊆ {by, field, dir}；判别键**恰现其一**
    （`by` 与 `field` 同现或全缺如 `{}` 均非法）；`by` ∈ {'index','key'}（其它字面量非法）；`field` 须
    `typeof string`；`dir` 在场须 'asc'|'desc'（'up' 非法，G4）；
  - **face 词表**（G4）：数组面仅 `by:'index'`（`field` / `by:'key'` → 非法）；键面 `by:'key'` 或 `field`
    （`by:'index'` → 非法）；缺省 term：数组面 `{by:'index',dir:'asc'}`、键面 `{by:'key',dir:'asc'}`；
  - `orderBy` 整体非 plain（列表/字符串/null/42）→ 非法（G5）。

### D10 码点比较器（string 组 + 身份锚共用；SA2-F2 补钉）

JS 关系运算符按 UTF-16 码元序——`\uFFFD`（0xFFFD）会排在代理对（0xD83D…）之后，违反码点序。钉死：**string
组比较用码点迭代比较器**（`codePointAt` 逐码点字典序，短前缀者小）；禁 `localeCompare`（locale 依赖，破坏
确定性）。number 组用数值比较（有限数，D4 已滤 non-finite）。

**【SA2-F2】身份锚比较器钉死**：键面平局锚与不可比尾组锚的字符串身份（key）比较**复用同一码点迭代比较器**
（与排序键同一比较器，保总序一致性）——实现者用 `<`（码元序）即与码点纪律分叉，且契约键全为 ASCII 不可区分
（astral/BMP 混合键下序不同）。数组面身份是数值下标，天然全序。**可执行锚 = pins P8**：field 基平局键
`'\uFFFD'` 与 `'\u{1F600}'` 同分——码点锚两方向均 `['\uFFFD','\u{1F600}']`（0xFFFD < 0x1F600）；码元序实现
得 `['\u{1F600}','\uFFFD']`（0xD83D < 0xFFFD）→ 红。

### D11 公共类型面（经 `src/index.ts` 导出；`export type` 遵 `verbatimModuleSyntax`）

```ts
// packages/doc-runtime/src/window.ts（新）；index.ts 加法导出
export type WindowDir = 'asc' | 'desc';
export type IndexWindowTerm = { by: 'index'; dir?: WindowDir };   // readArrayWindowAtPath 专属
export type KeyWindowTerm = { by: 'key'; dir?: WindowDir };       // readMapWindowAtPath 键基
export type FieldWindowTerm = { field: string; dir?: WindowDir }; // readMapWindowAtPath 值属性基（v1 单段）
export type WindowTerm = IndexWindowTerm | KeyWindowTerm | FieldWindowTerm; // ADR 0028 决策 2 联合（W2 复用）

export interface ReadArrayWindowOptions {
  n: number;
  orderBy?: IndexWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
}
export interface ReadMapWindowOptions {
  n: number;
  orderBy?: KeyWindowTerm | FieldWindowTerm;
  depth?: number;
  maxChildrenPerNode?: number;
}
export interface ArrayWindowEntry { index: number; value: unknown; }
export interface MapWindowEntry { key: string; value: unknown; }

export type WindowFailureCode =
  | 'WINDOW_TARGET_ABSENT'
  | 'WINDOW_CARRIER_MISMATCH'
  | 'WINDOW_OPTIONS_INVALID'
  | 'PATH_NOT_ALLOWED'; // 投影域透传（D8）：入选项物化失败 / E100 / 导航纪律失败

export interface WindowReadFailure {
  ok: false;
  code: WindowFailureCode;
  path: readonly (string | number)[];
  message: string;
}
export type ReadArrayWindowResult = { ok: true; value: ArrayWindowEntry[] } | WindowReadFailure;
export type ReadMapWindowResult = { ok: true; value: MapWindowEntry[] } | WindowReadFailure;

export function readArrayWindowAtPath(doc: Y.Doc, path: readonly (string | number)[], options: ReadArrayWindowOptions): ReadArrayWindowResult;
export function readMapWindowAtPath(doc: Y.Doc, path: readonly (string | number)[], options: ReadMapWindowOptions): ReadMapWindowResult;
```

说明：`options` 设计为必填第三参（`n` 必填；契约 B-3 同形——测试侧以 `(doc, path, options?)` 动态调用，缺
options → `n` 缺失 → `WINDOW_OPTIONS_INVALID`，与 G3 一致）；`exactOptionalPropertyTypes` 下 `dir?`/`orderBy?`
不带 `| undefined`（键在场值 undefined 的运行时 ≡ 缺席规则由校验承担，姊妹 R1 镜像）；face 专属 options 类型
把 v1 词表编码进编译期（数组面传 `field` 即 TS 报错），运行时校验仍是唯一权威（G4/G5 敌意输入闭环）。
`noUncheckedIndexedAccess` 下实现须处理数组索引可能 undefined 的类型收窄。

### D12 【SA2-F1 落实·必选】钉死项可执行锚：`issue-368-window-read-design-pins.test.ts`

**状态：必选**（原 iteration 0 设计的「可选推荐」升格——SA2-F1 MAJOR：D8/D4 两处承重失败语义原零可执行锚，
错误路径可伪绿：跳项/半窗实现与 NaN 进 number 组实现均可通过全部 45 契约用例 + 守卫）。

**文件纪律**：

- 路径 `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts`；被 root `vitest.config.ts` L15
  `packages/*/test/**/*.test.ts` include 采集（本轮实核）；被 `packages/doc-runtime/tsconfig.json`
  （include 含 `test/**/*.ts`）类型检查——SA6 §4 已证契约文件同模式零类型错；
- 入口解析纪律与契约同款（§绑定常量 + `windowEntry` 存在性断言，描述性红因消息）：**实现前全组红于入口
  存在性**（红因统一：`typeof ns[export] === 'function'` 断言失败），**实现后全绿**；
- pins 文件自有最小断言助手（成功/失败结算判别联合），**不从契约文件 import**（测试文件独立；契约文件
  §11 DENY 不动）；`readLogicalValueAtPath` 直接 import（已存在）作对账/负控；
- fixture 全部内联（沿契约 §12.8 惯例），从契约复用的 fixture 同构复制并注明出处注释；
- fixture 可建性探针（本轮只读 node 探测，未落盘，§2.11）：Y.Map 显式 undefined 值键、detached Y.Map 经
  plain holder 可达——P4/P6 不是空头规格。

**锚点集**（P1/P2 = SA2-F1 阻断最小集；P2b–P8 = 同文件必选承载——采纳 SA2-F1「建议随行」与 SA8 iteration 3
§8-6 建议，理由：与 P1/P2 同属「钉死语义零可执行锚」缺口类（SA2 §12 定性为同类低风险）、fixture 互斥复用、
边际成本≈0；D3 不设专锚：契约 A1–A8 已可执行锚定值键总序，加锚纯属重复）：

| Pin | 锚定语义 | fixture 要点 | 关键可观察断言与杀伤面 |
|---|---|---|---|
| **P1**（阻断） | **D8 透传防静默跳项**（fail-fast、无半窗、path 精确到项、message 非空） | 契约 `makeSentinelDoc` field 部分同构内联（注明出处）：Y.Map `field` = {f1:{s:1}, f2:{s:2}, f3:{s:3,bad:NaN}}；负控：姊妹读 `['field','f3']` 必 `ok:false`（NC5 同款对账） | `mapWindow(doc,['field'],{n:3,orderBy:{field:'s'}})`：(a) `expect(fn).not.toThrow()`（同步零外抛）；(b) `ok === false`；(c) `code === 'PATH_NOT_ALLOWED'`（严格相等）；(d) 失败联合**不携带 value**（无半窗）；(e) `path` 深等于 `['field','f3']`；(f) `message` 为非空 string。杀伤：静默跳项（返回 f1/f2 两条 `ok:true`）、补位、冒充三码（MISMATCH/OPTIONS_INVALID）、吞错转 ok——全红 |
| **P2**（阻断） | **D4 non-finite 归尾**（field 基） | Y.Map `tasks`：n1:{score:2}, n2:{score:10}, s1:{score:'a'}, q1:{score:NaN}, q2:{score:-Infinity}, q3:{score:+Infinity}, q4:{}（缺失）, q5:{score:true}；**插入序刻意打乱**（如 q5,q3,q1,s1,n2,q2,q4,n1）——契约 C 组尾组插入序恰同键序、锚不可区分，本 pin 补此盲区（Y.Map `keys()` 为插入序） | asc（n:9）键序 `[n1,n2,s1,q1,q2,q3,q4,q5]`；desc（n:9）`[n2,n1,s1,q1,q2,q3,q4,q5]`（组间序恒定、尾组两方向同位、组内键 asc 恒定）；边界 n=5：两方向第 4/5 位均 q1,q2。杀伤：±Inf 归 number 组（asc 首位变 q2 / desc 首位变 q3）、NaN 进 number 组（位次漂移）、尾组随 dir 翻转、锚用插入序——全红 |
| P2b | D4×D3 数组面值键归尾 | Y.Array `[5, NaN, 1, -Infinity, +Infinity, 'a']` | asc 下标序 `[2,0,5,1,3,4]`；desc `[0,2,5,1,3,4]`（值组序 + 尾组下标 asc 两方向不变；±Inf 归 number 组则 desc 首位变 4、asc 首位变 3——红） |
| P3 | D5 field 单段字面键（点号/空串不拆分） | (a) `{c1:{'a.b':3}, c2:{'a':{b:7}}, c3:{'a.b':'x'}}` + `field:'a.b'`；(b) `{e1:{'':5}, e2:{a:1}}` + `field:''` | (a) asc 键序 `[c1,c3,c2]`（c1 命中字面键=3、c3='x'、c2 缺失归尾）；点号拆分实现把 c2 钻到 7 → `[c2,…]` 首位即异——红。(b) asc `[e1,e2]`（空串是合法字面键） |
| P4 | D6 undefined 值键出条目空间 | Y.Map `{u: undefined（显式 set，探针实证）, a: 1}`；plain object `{u: undefined, q: 1}` | 键基 n:5：条目恰 `[{key:'a',value:1}]` / `[{key:'q',value:1}]`；'u' 不在条目空间（含插入序后位，排除「恰被 n 截掉」的侥幸通过） |
| P5 | D7 空路径 `[]` | fresh doc；ROOT 含键 doc | `mapWindow(doc,[],{n:5})`：fresh → `{ok:true,value:[]}`；含键 → 键窗口；`arrayWindow(doc,[],{n:1})` → `WINDOW_CARRIER_MISMATCH`（ROOT 是 Y.Map） |
| P6 | D7 detached 目标（探针实证可构造） | `root.set('holder',{inner:new Y.Map()})`（→ `['holder','inner']` = detached YMap）；`root.set('arr',[new Y.Map()])` | P6a `mapWindow(doc,['holder','inner'],{n:1})` → `PATH_NOT_ALLOWED`（非 MISMATCH/非 ABSENT——面符但不可读）；P6b `arrayWindow(doc,['arr'],{n:1})` → 唯一候选归尾组入选 → 物化期 detached 项失败 → `PATH_NOT_ALLOWED`（D8 同通道，与 P1 互证） |
| P7 | D9/B-5 own 键集自诺（SA2 非阻断观察 1 兑现） | 任一成功调用 + P1 的失败结算 | 成功 own 键集（`Object.keys` 排序）恰 `['ok','value']`；失败恰 `['code','ok','path','message']` |
| P8 | SA2-F2 身份锚码点比较器 | field 基平局：键 `'\uFFFD'` 与 `'\u{1F600}'` 两 child 同 `score:5` | asc 与 desc 两方向平局段均 `['\uFFFD','\u{1F600}']`（码点 0xFFFD < 0x1F600）；码元序锚实现得 `['\u{1F600}','\uFFFD']`——红 |

**备选（否决）**：只加 P1/P2 两锚、其余钉死项维持零可执行锚——SA2 §12 已定性 D5/D6/D7 为「同类但风险较低」
缺口；文件既已必选，留同类缺口即在同一文件内自拆台阶。**备选（否决）**：把 pins 并入契约文件——契约文件
SA6 §12.7-4 禁改（语义断言零改动红线），且契约是 SA6 产物、pins 是 SA1 设计锚，产物归属分离。

---

## 8. 接口、状态机和数据流

### 8.1 调用编排（两入口共用骨架；同步、零抛、零订阅、模块级零可变态）

```
readArrayWindowAtPath / readMapWindowAtPath(doc, path, options)
  ├─ G0  path 非数组 → PATH_NOT_ALLOWED（DOCRT-E100 前缀 message）
  ├─ OPT 校验 options + orderBy（封闭形状；零 doc 触碰）→ WINDOW_OPTIONS_INVALID
  ├─ N0  probeRoot(doc) → ROOT 非 Y.Map → PATH_NOT_ALLOWED
  ├─ N1  导航循环（姊妹段纪律；缺席位 → WINDOW_TARGET_ABSENT；纪律位 → PATH_NOT_ALLOWED）
  ├─ C   目标载体面检查（attached Y.Array|plain array / attached Y.Map|plain object）
  │       ├─ 面符 → 枚举        ├─ detached → PATH_NOT_ALLOWED
  │       └─ 其它 → WINDOW_CARRIER_MISMATCH
  ├─ E   候选枚举 + 排序键分类（原始读：index 基=项值；key 基=键串；field 基=单段下钻值）
  │       组 0=有限 number（Number.isFinite 门，D4）· 组 1=string · 组 2=不可比（缺失/null/布尔/容器/non-finite/其它）
  ├─ S   全序排序：组序（恒定）→ 组内值序（dir 敏感；number 数值 / string 码点 D10）
  │       → 身份 asc 锚（恒定；键面 string 身份复用 D10 码点比较器，SA2-F2；数组面数值下标天然全序）
  │       窗口 = 前 min(n, 候选数) 项
  ├─ M   逐入选项：entry.value = readLogicalValueAtPath(doc, [...path, 身份], 预算|两参)
  │       （任一项失败 → D8 透传 PATH_NOT_ALLOWED：fail-fast、无半窗、无跳项、无补位 —— pins P1/P6b）
  └─ A   成功 {ok:true, value:[{index|key, value}…]}（恰两键，pins P7；条目字面量构造）
  顶层 try/catch（E100 镜像）→ PATH_NOT_ALLOWED（safeDetail/safeSpreadPath 同款收编，绝不二次抛）
```

状态机视角：无跨调用状态（每次调用独立、无 memo、无订阅——INV-R9/R10 镜像）；单次调用是纯函数式流水线，
唯一外部触碰 = 只读 Y.Doc 访问（probeRoot 惰性建 ROOT 属姊妹既有行为，零 update 事件）。

### 8.2 数据流路线

| 路线 | 触发者与输入 | 写入或创建点 | 转换与边界 | 存储或传输 | 读取或投影点 | 可观察结果 | 错误与清理 | 验收锚点 |
|---|---|---|---|---|---|---|---|---|
| W1-R1 options 控制流 | 调用方 options/orderBy（敌意可能） | 无写入 | descriptor 级封闭校验（内层 try 收编 trap） | 无 | 无 doc 触碰 | `WINDOW_OPTIONS_INVALID`（ok/code + path/message） | 零外抛零 accessor 执行零变异；无需清理 | G3/G4/G5/G6/G7 |
| W1-R2 目标解析 | `(doc, path)` | 无（probeRoot 惰性建空 ROOT，零 update 事件，姊妹既有） | N0 探针 + N1 导航（姊妹段纪律；缺席改判响亮） | 无 | ROOT→目标路径逐段只读 | 到达目标载体 或 ABSENT/PATH_NOT_ALLOWED | 只读无清理 | G1/G2、NC1（姊妹吸收对照）、P5（空路径）、P6a（detached） |
| W1-R3 选窗（枚举/分类/排序） | 目标容器（Y.Array/plain array/Y.Map/plain object） | 无 | O(N) 原始键读 + 类型组分类（`Number.isFinite` 门）+ 全序排序；**未入选子树零读取** | 内存比较器中间结构（调用局部） | 无深读取 | 有序身份列表（前 min(n,N)） | 无副作用；毒值未入选 → 不可观察 | A1–A8/B1–B3/C1–C4/H1、F1–F5、**P2/P2b/P3/P4/P8** |
| W1-R4 入选项物化 | 有序身份列表 × 预算轴 | 无 | `[...path, 身份]` → 公共姊妹 `readLogicalValueAtPath`（跨模块边界：window.ts → read.ts 公共面） | 无 | 姊妹双递归投影（putKey 纪律） | `entry.value`（普通逻辑值） | **项读失败 → PATH_NOT_ALLOWED 透传（fail-fast，无跳项/无半窗）；无部分结果泄漏** | E1–E5、D3、**P1（防跳项直锚）、P6b（detached 项）** |
| W1-R5 结果装配 | 条目列表 | 调用方获得新构造对象（字面量条目 + 姊妹产出的投影值） | 成功恰两键（P7） | 无 | 无 | `{ok:true, value}` 或失败联合 | 无 | D1–D5、A6/B3（同构）、H1、**P7（own 键集）** |

无持久化、无 wire、无诊断日志、无 schema 通道参与；全部数据形态为进程内普通值。

---

## 9. 错误、恢复、并发和幂等

| 失败码 | 触发 | 契约/pins 锚 | 调用方可观察 |
|---|---|---|---|
| `WINDOW_OPTIONS_INVALID` | options/orderBy 任一校验失败（§8.2 D9 规格：宿主/键空间/n 边界/dir 枚举/face 词表/判别键/敌意 trap） | G3/G4/G5/G6/G7 | `{ok:false, code, path:<新鲜回显>, message}`；同步零抛；敌意输入零 accessor 执行 |
| `WINDOW_TARGET_ABSENT` | 导航缺席位：中间/终点缺键、数组越界（姊妹 D4 吸收位改判响亮） | G1、G8、**P5（数组面空路径位）** | 同上；**不做缺席吸收**；不与姊妹吸收互渗（NC1） |
| `WINDOW_CARRIER_MISMATCH` | 目标在场但面不符（含标量/XmlFragment/Y.Text/异类；两 face 交叉；ROOT 对数组面） | G2、G8、**P5** | 同上；agent 可程序化改选另一入口（ADR 决策 7） |
| `PATH_NOT_ALLOWED`（透传） | 入选项物化失败（投影不可表示值/detached 项——**绝不静默跳项/补位**）；导航纪律位（段型不符/终态/值域违规/detached 中间或终点载体/ROOT 非 Y.Map）；E100 | NC5（毒值有牙，间接）；**P1（直测：防跳项 fail-fast 无半窗 + path 精确到项）、P6a/P6b（detached）** | `{ok:false, code:'PATH_NOT_ALLOWED', path:<项路径或实参路径新鲜副本>, message 非空}`；响亮不抛 |

- **恢复/重试**：全部失败为稳定判别联合（同步返回，非异常）——调用方按 code 分派；无内部重试、无部分结果
  （fail-fast：首个物化失败即整窗失败，无半窗泄漏——P1 锚定）；
- **回滚**：纯读原语，零写入零事件零订阅，无回滚需求；
- **并发**：同步单线程；调用期间只读 Y.Doc；与写事务的交错由 yjs 单线程语义吸收（与姊妹同域，不新增并发面）；
- **幂等/确定性**：同 doc 重复调用、孪生 doc 同数据 → 逐字节一致（H1；全序比较器 + 身份唯一锚由构造保证，
  不依赖 sort 稳定性、不依赖 Y.Map 插入序（P2 打乱插入序实证锚）、无时钟/随机/locale 依赖）。

---

## 10. 调用方影响矩阵

| 调用方 | 当前处理 | 设计后处理 | 所需改动 | 证据 |
|---|---|---|---|---|
| **doc-runtime 既有消费方**（SA2-F3 标签修正：下列 7 文件消费 doc-runtime 公共面；其中**姊妹读 `readLogicalValueAtPath` 的生产调用唯一**在 `namespace-runtime/src/runtime.ts`）——`packages/namespace-runtime/src/runtime.ts`（姊妹读 + 4 个类型导入）；`…/write.ts`（`applyValidatedMutation`/`DocRuntimeFatalError`/类型）；`…/schema-write.ts`（`replaceSchemaAndRoot`/`DocRuntimeFatalError`/类型）；`…/errors.ts`（仅 `DocRuntimeFatalPhase` 类型）；`…/index.ts`（仅再导出 `ReadLogicalValueTruncationEntry` 类型）；`packages/namespace-registry/src/{registry,create-diagnostic}.ts`（`DocRuntimeFatalError`）；`…/create-document.ts`（`createInitialDocument`） | 只消费既有读/mutation/fatal/create/replace 面，零窗口接触 | 不受影响（零签名/语义/options 变化；新导出纯加法） | 无 | 本轮全仓 grep 实证（`from '@nomicore/doc-runtime'` 7 文件逐条核对；`packages/vfsl/src/index.ts` L86 仅注释提及姊妹读，无 import） |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | 逐导出记账（applyValidatedMutation 专项 + owner 五导出 + MUTATION_GUARD_MISMATCH） | 须为 `readArrayWindowAtPath`/`readMapWindowAtPath` 记账（存在性 + typeof function + 命名空间键审计防别名） | **须加法扩展**（AGENTS 纪律；SA6 §10 明示属允许范围） | AGENTS Boundaries；守卫文件实读 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | 类型名目正例 import + `@ts-expect-error` 负例 | 须加 D11 新类型名目正例（可选：WindowTerm 闭合联合编译期负例，如同文件 ADR 0025 先例） | **须加法扩展** | 同上 |
| `packages/doc-runtime/test/doc-runtime-surface.test.ts` | declaration emit 存在性审计（createInitialDocument/Y.Doc/无内部 subpath） | 新导出只增加声明文本，无移除——存在性断言不受影响 | 无（复核即可） | §2.8 实读 |
| SA6 契约文件 `issue-368-window-read-contract-red.test.ts` | 39 红（能力缺失断言）+ 6 绿负控 | 绑定取默认 → **零改动**；实现后 39 红转绿、6 负控保持绿 | **禁止改动**（§11 DENY） | SA6 §12.7-4 |
| **必选 pins 文件 `issue-368-window-read-design-pins.test.ts`（新）** | 不存在 | D12 规格 P1–P8；实现前红于入口存在性、实现后绿 | **须创建（必选，SA2-F1）** | SA2-F1；vitest.config.ts L15 |
| W2（#369，未来）lease 层 | 不存在 | 将以本原语为组合基（`readArray`/`readMap` 四键结算 + schema 文本）——**本设计不预占其冻结面**（D9） | 无（未来票） | ADR 0028 决策 9 |

未覆盖调用方：无（新公共 API 无存量消费者；仓内唯一审计面 = 两守卫测试 + 契约/pins 测试文件，已列入 ALLOW/DENY）。

---

## 11. 文件范围

### ALLOW LIST

| 路径 | 预期改动 | 原因 |
|---|---|---|
| `packages/doc-runtime/src/window.ts`（新建） | 两入口 + 全部窗口私有逻辑与类型（D1–D11；复制集与出处标记见 D2） | 新公共能力的唯一实现载体；read.ts 零 diff 红线（D2） |
| `packages/doc-runtime/src/index.ts` | 加法导出：2 值导出 + D11 类型导出（带 ADR 0028 缝 1 注释） | AGENTS「公共 API 仅经 src/index.ts」 |
| `packages/doc-runtime/test/public-surface-guard.test.ts` | 加法 describe：两新值导出记账（存在性/函数形态/键审计） | AGENTS「守卫测试逐导出记账」；SA6 §10 |
| `packages/doc-runtime/test/public-surface-type-guard.test-d.ts` | 加法：D11 类型名目正例（可选编译期负例） | 同上（类型面） |
| `packages/doc-runtime/test/issue-368-window-read-design-pins.test.ts`（新建，**必选——SA2-F1 升格**） | D12 全规格锚点集：**P1（D8 防静默跳项：n:3 全选含毒项 → `ok:false`/`PATH_NOT_ALLOWED`/同步不抛/无半窗/path=项路径/message 非空）与 P2（D4：score NaN/-Inf/+Inf 全落不可比尾组、组内键 asc、两方向组位不变、插入序打乱）为阻断最小集**；P2b（数组面值键归尾）、P3（field 点号/空串字面键）、P4（undefined 值键出条目空间）、P5（空路径）、P6（detached 目标/项）、P7（成功恰两键/失败四键 own 键集）、P8（astral 平局键码点锚）同文件必选承载；实现前红于入口存在性、实现后绿、root `pnpm test` 采集（vitest.config.ts L15） | **SA2-F1 MAJOR**：D8/D4 两处承重失败语义原零可执行锚，错误路径可伪绿（跳项/NaN 归 number 组实现可通过全部契约+守卫）；升格后钉死语义可执行（SA8 注记 3「不得实现期临场发明」的最强兑现）；P2b–P8 采纳 SA2-F1「建议随行」+ SA8 iteration 3 §8-6 建议（同类零锚缺口、边际成本≈0） |

### DENY LIST

| 路径 | 与任务的关系 | 禁止修改原因 |
|---|---|---|
| `packages/doc-runtime/src/read.ts` | 姊妹原语 | SA8/SA6 冻结面：三参签名与无 options 语义逐字不变、options 闭合形状零改动；D2 取零 diff 最严格读法（复制集出处标记使漂移可检，SA2-F4） |
| `packages/doc-runtime/src/carrier.ts` 及本包其余 src 文件 | 复用对象 | 已导出 `carrierOf`/`probeRoot` 足够；其余无涉 |
| `packages/doc-runtime/test/issue-368-window-read-contract-red.test.ts` | SA6 已验收契约 | SA6 §12.7-4：不得为过契约改语义断言；绑定取默认 → 无需改 §绑定 常量 |
| `packages/doc-runtime/test/` 其余既有测试文件 | 基线回归面 | 纯加法纪律；既有 674 用例是冻结对照 |
| `packages/namespace-runtime/**`、`packages/namespace-registry/**` | W2/W3 范围 | Owner override 负向清单；依赖边强制（#369 ← #363/#364） |
| `packages/vfsl/**` 及 `docs/adr/0027*`（如出现） | ADR-0027 阶段（T1/T2） | override 仅豁免 seam-1 时序，不改变 T1/T2 归属 |
| `docs/adr/**`、`CONTEXT.md` | 决策与词汇基线 | override 路径零文档改动（SA8 iteration 1 §8-1/§6-2）；钉死项以设计记录 + 必选 pins 双锚定（§13-R6） |
| `docs/protocols/**`、持久化/诊断日志/wire 相关包 | 零接触面 | W1 纯 doc-runtime 读原语（SA8 盘点 no-conflict 行） |
| `wiki/raw/task_issue-368*`（本设计除外） | 上游产物 | 只读输入 |

---

## 12. 验收与验证映射

| 需求或风险 | 现有证据 | 所需行为测试或动态场景 | 预期观察 |
|---|---|---|---|
| AC1 选窗正确性矩阵（基 × dir × 组序 × 尾组 × 平局锚） | 契约 W1-A1…A8 / B1–B3 / C1–C4 / H1（当前红 = 入口缺失） | 实现后同一套件 | 39 红全转绿：条目列表 `toStrictEqual`；组间序两方向恒定；锚 asc 恒定；码点序（含 astral）；载体同构（Y vs plain） |
| AC2 零物化哨兵 | 契约 W1-F1…F5 + NC5（哨兵有牙） | 同上 | 未入选子树毒值（non-finite/稀疏空洞）→ `ok:true` 且入选条目精确；N=2000 规模哨兵 |
| AC3 条目列表形态 | 契约 W1-D1…D5 | 同上 | own 键集恰 `{index\|key,value}`；身份随行指向同值；空容器（四载体）→ `[]`；`__proto__` 敌意键免疫 |
| AC4 组合式 depth 等价 | 契约 W1-E1…E5 | 同上 | 每项 `entry.value` ≡ `readLogicalValueAtPath(项路径, 同预算)` 逐字节一致；`maxChildrenPerNode` 只治项内部；终点宽度由 n |
| AC5 三失败码 + 敌意 options | 契约 W1-G1…G8 | 同上 | 三码各就各位且互异；n 边界全枚举；语境外排序项；Proxy trap 与 accessor 零外抛零执行（accessorRuns === 0） |
| AC6 typecheck/测试全绿（纯加法） | SA6 §4/§13 基线（root 379 文件唯一红 = 契约组） | 实现后：`pnpm --filter @nomicore/doc-runtime typecheck`（或 `tsc -p packages/doc-runtime/tsconfig.json`）；root `pnpm typecheck`；root `pnpm test`；定向 `NODE_OPTIONS=--conditions=nomicore-source vitest run packages/doc-runtime` | 契约文件 45/45 绿（39+6）；**pins 文件 P1–P8 全绿**；既有 674 用例绿；root typecheck exit 0；root test 全绿 |
| **【SA2-F1】D8 透传防静默跳项（承重语义一）** | 设计 D8 + NC5（间接：毒值有牙）；契约刻意不测（SA6 §15-2）——原零直测锚 = 错误路径伪绿通道 | **必选 pins P1**（+ P6b detached 项同通道互证） | `n:3` field 基全选含毒项 → `ok:false`、`code:'PATH_NOT_ALLOWED'`、同步不抛、失败联合无 value（无半窗）、`path = ['field','f3']`、message 非空；跳项/补位/冒充三码实现全红 |
| **【SA2-F1】D4 non-finite 归尾（承重语义二）** | 设计 D4（SA8 注记 3 移交钉死项）；契约对排序键 non-finite 零断言——原零锚 | **必选 pins P2 + P2b** | NaN/+Infinity/-Infinity 排序键全落不可比尾组、组内键 asc、asc/desc 两方向组位不变、插入序打乱下锚稳定；归 number 组/尾组随 dir 翻转/锚用插入序实现全红 |
| D3/D5/D6/D7 钉死 | 本设计 §7（D3 = 契约 A 组已锚；D5/D6/D7 原零锚） | **必选 pins P3/P4/P5/P6**（随 F1 升格同文件承载） | 点号/空串 field 字面寻址、undefined 值键出条目空间、空路径两 face 行为、detached 目标/项 `PATH_NOT_ALLOWED` |
| 成功面恰两键 / 失败面四键（D9/B-5 自诺） | 设计自诺；契约 B-5 刻意不锁键集 | **必选 pins P7**（SA2 非阻断观察 1 兑现） | 成功 own 键集 `['ok','value']`；失败 `['code','ok','path','message']` |
| 身份锚码点比较器（SA2-F2） | D10 钉死；契约键全 ASCII 不可区分 | **必选 pins P8** | astral 平局键两方向均 `['\uFFFD','\u{1F600}']`；码元序实现红 |
| 姊妹冻结面不回渗 | 契约 W1-NC1/NC2/NC3/NC6（当前绿） | 实现后保持 | 缺席吸收两键面、options 闭合拒绝窗口键、预算四键面、9 值导出纯加法——全部保持绿 |
| 公共面记账 | 守卫两文件（当前不含窗口导出） | ALLOW LIST 第 3/4 行更新后运行 | 新导出存在性/函数形态/类型名目可导入；无别名绕过 |

SA1 不执行上述验证；执行归 SA3（实现 + 守卫更新 + pins 文件）/ SA7（复核），依仓例由 Controller 路由。
pins 期望值若在实现期发现 fixture 不可建（与 D12 探针结论矛盾），属设计缺陷退回 SA1，不得临场改测试期望
（与 SA6 §12.7-4 同纪律）。

---

## 13. 风险、回滚和残余问题

| # | 风险/残余 | 等级 | 处置 |
|---|---|---|---|
| R1 | **D3 解释性钉死**（数组面值键语义 vs ADR 注释「自 [0] 取」的字面张力） | 低（降级） | SA8 iteration 3 #2 已裁 no-conflict + SA2 §6 独立重算契约期望互证；契约 A 组为可执行锚；残余 = Owner/SA2 后续改采纯索引读法 → 按 iteration 3 §8-4 改契约 A 组 + 实现 + 重开复查（修订面封闭，无需 ADR 变更） |
| R2 | D8 使 `PATH_NOT_ALLOWED` 成为窗口可观察第四码：与「三失败码」措辞的表面张力 | 低（降级） | SA8 iteration 3 #7 已裁 no-conflict（三码语义逐字保持；透传是空白处唯一不吞错读法）；语义分层论证 + 契约无反例；**可执行锚 P1/P6 已就位**；SA4/SA7 复核焦点；若仍被否决，替代方案需 Owner 拍板（iteration 3 §8-5）——登记为**所需决策**而非静默改 |
| R3 | Y.Map 显式 undefined 值键出条目空间（D6）为契约未测钉死：若 W2 lease 口径需要「undefined 值键占位」，本层语义需对账 | 低 | 载体同构（A6/B3）+ 姊妹 E1 吸收同构论证 + **P4 可执行锚**（探针实证 fixture 可建）；W2 开工时对账（其 blocked_by 边已强制排后） |
| R4 | 排序 O(N log N) 超出决策 8 字面成本清单 | 低 | SA8 iteration 3 #8 已裁：清单是成本下界义务枚举非禁令；行为哨兵锚物化而非墙钟；partial-selection 优化登记 follow-up（零可观察差异） |
| R5 | 实现期把排序键分类做成投影（如复用 copyPlainStrict）→ 破坏零物化（F 组红）；或实现期静默跳过失败项 / 把 non-finite 归 number 组 | 中→低 | D6 明示分类 = typeof/`Number.isFinite`/carrierOf 级原始读；F3/F5 行为哨兵 + **P1/P2 直测锚**（SA2-F1 落实后错误路径不再伪绿）；SA4 复核清单列入（复制集逐函数对账 + P1/P2 期望核对） |
| R6 | 钉死项以设计记录锚定、未回写 ADR/CONTEXT | 低 | SA8 注记 3 允许双路径；iteration 3 §6 确认零 evolution-required；**本轮起为设计记录 + 必选 pins 可执行锚双锚定**；override 路径零文档改动是既裁方针；若 Owner 改走词条回写，触发 iteration 2 §7-2 基线漂移复查——非本任务内必要条件 |
| R7 | 契约 45 用例 + 必选 pins（P1–P8 + 负控对账）+ 守卫更新的测试面膨胀拖慢 root `pnpm test` | 低 | 全部为纯同步单 doc 读测试（SA2 §14-4 确认）；F5 已是最大规模（N=2000）；pins 无规模哨兵、fixture 内联；无新增异步/服务面 |
| R8 | 回滚：纯加法实现（新文件 + index 导出 + 测试），revert 即恢复基线 | — | 无数据迁移、无持久化格式、无 wire 变化；回滚 = 删除 ALLOW LIST 改动 |
| R9 | pins 期望值与实现现实冲突（fixture 不可建 / yjs 行为与探针不符） | 低 | D12 探针已证 P4/P6 fixture 可建（Yjs 显式 undefined 值键、detached 经 plain holder 可达）；其余 pins 只用契约已验证的构造模式；冲突时按 §12 末段纪律退回设计，不临场改期望 |

**任务内无未解决必要条件**；无需阻塞上报。follow-up（非本票）：多字段排序/嵌套 field/readArray 属性排序/n=0
探针（ADR 0028 开放问题，均为零形状变化演进位）；partial-selection 排序优化；**read.ts 冻结解除时评估抽共享
模块消复制（SA2-F4；D2 出处标记使逐函数对账可行）**；W2 对账 R3。

---

## 14. 评审修订映射

评审输入：`wiki/raw/task_issue-368_sa2_review.md`（SA2，iteration 0，verdict **reject**：1 MAJOR / 3 MINOR；
「升格 pins（最小两锚）后即可 approve」）。

| Finding | 修订位置 | 处理结果 |
|---|---|---|
| **SA2-F1（MAJOR）**：D8 防静默跳项与 D4 non-finite 归组两处承重失败语义零可执行锚，错误路径可伪绿（跳项/NaN 归 number 组实现可通过全部 45 契约用例 + 守卫；E 组等价锚只对已返回条目对账、被跳条目不可见） | §1 目标 9；§7-D4（锚注 + P2 杀伤面）；§7-D8（锚注 + P1 杀伤面）；**§7-D12（新：pins 全规格 P1–P8）**；§8.1-M/A、§8.2-R4、§9 失败表；§10 新调用方行；§11 ALLOW 第 5 行（升格必选）；§12 两承重语义行 + AC6/pins 行；§13-R5/R7/R9；实现边界摘要 | **落实**：pins 文件从「可选推荐…不加不阻塞」升格为**必选**；**P1（D8：`makeSentinelDoc` field fixture 同构，n:3 全选含毒项 → ok:false / PATH_NOT_ALLOWED / 同步不抛 / 无半窗 / path 精确到项 / message 非空）与 P2（D4：score NaN/-Inf/+Inf 全落尾组、组内键 asc、两方向组位不变）为阻断最小集**（逐字采纳 SA2 建议的用例设计）；P2b–P8 同文件必选承载（采纳「建议随行」+ SA8 iteration 3 §8-6；同类零锚缺口、边际成本≈0，D12 备选节记录否决理由）；红绿纪律（实现前红于入口存在性）与 vitest 采集（L15，本轮实核）入规格 |
| **SA2-F2（MINOR）**：键面平局锚/尾组锚的字符串比较器未钉死（码点 vs 码元在 astral/BMP 混合键下序不同；契约键全 ASCII 不可区分） | §7-D10（身份锚比较器钉死段）；§7-D3（数组面身份注）；§8.1-S；§12 身份锚行；**D12-P8** | **落实**：钉死「身份锚（key asc）复用 D10 码点迭代比较器（与排序键同一比较器）」；采纳可选 astral 平局键用例为必选 P8（`'\uFFFD'` vs `'\u{1F600}'` 两方向锚序断言） |
| **SA2-F3（MINOR）**：§10 首行把消费其它导出的 6 文件误标为「`readLogicalValueAtPath` 既有调用方」（姊妹读生产调用唯一在 runtime.ts；vfsl/index.ts 仅注释提及） | §10 首行重写 | **落实**：标签改「doc-runtime 既有消费方」，按文件注明实际消费面（姊妹读仅 `namespace-runtime/src/runtime.ts`；write/schema-write/errors/index/registry/create-diagnostic/create-document 消费 mutation/fatal/create/replace/类型；vfsl L86 注释）——本轮全仓 grep 复核后写入 |
| **SA2-F4（MINOR）**：D2 复制集枚举不全（navClassify 等价 switch、segMsg、yjsWord、readableArrayElement 未点名）+ 无漂移缓解约定 | §7-D2（复制集名目表 + 出处标记约定 + follow-up）；§13 follow-up；§11 DENY（read.ts 行注） | **落实**：复制集 9 件全名目（行号本轮 grep 实核：navClassify L436/segMsg L387/yjsWord L392/readableArrayElement L497/isPlainRecord L405/readableOwnDataValue L481/isNonNegInt L382/safeDetail L277/safeSpreadPath L259 + 新建码点比较器）；出处标记约定 `copied from read.ts@36a73bb`；follow-up：冻结解除时评估抽共享模块 |
| 非阻断观察 1（成功面恰两键无锚） | D12-P7；§12 | **采纳**：P7 own 键集断言（成功 `['ok','value']` / 失败 `['code','ok','path','message']`） |
| 非阻断观察 2（透传 message 非空） | D12-P1(f)；§9 PATH_NOT_ALLOWED 行 | **采纳**：P1 断言 message 非空 string；实现边界摘要列 SA4 复核项 |
| 非阻断观察 3（n=1e21 大整数合法无害） | §7-D9（n 校验注） | **确认无需处理**：记录 `Number.isInteger(1e21)===true` → 合法 → min(n,total) |
| 非阻断观察 4（pins 升格后测试面成本） | §13-R7 | **确认**：R7 重新评估，纯同步单 doc 读、无异步/服务面，评估仍成立 |
| 非阻断观察 5（F1–F4 无新 ADR 冲突面，不需重开） | §15 | **确认**：本轮修订不触发设计轮复查；实现轮义务不变（见 §15） |

---

## 15. 是否需要设计后 ADR 冲突复查及理由

**本轮修订：不需要新的设计轮 ADR 冲突复查**（`requiresConflictRecheck: false`）。理由：

1. SA2 §14-5 明示：F1–F4 均不构成新的 ADR 冲突面（F1 是验收充分性、F2 是 D10 一致性补钉、F3/F4 是文本
   精度），不需要为此重开 ADR 冲突检查；
2. SA8 iteration 3（设计层复查）已 clear：D3/D4/D8 裁为解释/空白填充（0 hard-conflict / 0
   evolution-required）；本轮修订**零语义改动**（全部钉死语义 D3–D8 原文保持），只把其可执行性从「可选」
   升格为「必选」并补三处文本钉死（F2 比较器、F3 标签、F4 名目）——不触碰任何被裁边界；
3. Owner override 范围零变化（§4）；pins 升格是正向清单内验收设计行为（纯测试加法）。

**实现轮复查义务不变**（承继 SA8 iteration 2 §7-1/§7-3 与 iteration 3 §8/§10，由实现/复核轮按仓例重开，
非本设计产物新触发）：公共 API 与失败码族符合性（`WINDOW_*` 码名逐字、缺席不吸收不回渗、read.ts 零 diff、
姊妹 options 零触碰）；D3/D4/D8 钉死项逐项与实现一致（**本轮起含 pins P1–P8 绿**）；范围越界（触 W2 lease
公共面 / schema 通道 / readData options / `docs/**`）即时使 override 失效并重开门禁；决策基线漂移（PR #367
改稿或 override 评论变动）按 iteration 2 §7-2 重跑。条件触发路径（iteration 3 §8-4/§8-5）：D3 被推翻 →
改契约 A 组 + 实现并重开；D8 被否决 → Owner 拍板第四码或入选项失败语义，不得实现期静默改。

---

## 实现边界摘要（交 SA3/SA4/SA7）

1. 只动 ALLOW LIST 五个路径；`read.ts` 与 SA6 契约测试文件零改动；
2. 两入口 = `src/window.ts` 新模块，导出仅经 `src/index.ts`；逐项物化字面调用公共姊妹
   `readLogicalValueAtPath`（预算轴原样透传；两轴均缺 → 两参调用）；read.ts 复制件逐函数带
   `copied from read.ts@36a73bb` 出处注释（SA2-F4）；
3. 三窗口码名逐字 `WINDOW_TARGET_ABSENT` / `WINDOW_CARRIER_MISMATCH` / `WINDOW_OPTIONS_INVALID`；响亮不抛；
   投影域失败透传 `PATH_NOT_ALLOWED`（D8：fail-fast、无半窗、无跳项、无补位——P1 直测）；
4. 敌意 options/orderBy：封闭 descriptor 校验、零外抛、零 accessor 执行、零 doc 触碰（非法时）；
5. 排序键分类只用原始读（D4 的 `Number.isFinite` 门、D10 码点比较器 **+ 键面身份锚同比较器**（SA2-F2）、
   身份 asc 恒定锚）；未入选子树零读取；
6. **pins 文件必选（D12 P1–P8）**：P1/P2 为 SA2-F1 阻断最小集；实现前红于入口存在性（与契约同款入口断言）、
   实现后绿；期望值冲突退回设计、不得临场改测试期望；
7. 守卫两测试加法记账新导出；实现后契约文件 45/45 绿、pins 全绿、既有 674 用例绿、root typecheck/test 绿；
8. 不得为过契约或过 pins 修改契约/pins 语义断言；本设计与 ADR/CONTEXT 的钉死项差异以本文档为设计记录锚定
   （+ pins 可执行锚）；SA4 复核清单：复制集逐函数对账（D2 名目）、P1/P2 期望核对、透传 message 非空。
