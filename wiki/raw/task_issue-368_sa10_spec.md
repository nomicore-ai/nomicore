# SA10 Spec 审查报告 — issue #368 W1：`@nomicore/doc-runtime` 载体级窗口原语（ADR 0028 缝 1）

- 角色：SA10（独立 Spec 审查者），dispatch `sa-783278fe-4ec0-4182-9311-2c603899d6f0`，phase spec-review，iteration 0
- 被审对象：**最终已提交 diff** `1b13e7c30248259d6b028c80929a661e09125451`（`feat(doc-runtime): add deterministic carrier windows`），
  基线 `36a73bb`（`docs(adr): ADR 0028 …设计基线`），branch `mabf/issue-368`
- 审查基准：issue #368 正文（REST 本轮复核：`open`、labels `in-progress`/`feature`、comments=1、updated 10:26:53Z
  非正文编辑，正文头与简报逐字一致）、Owner 评论 **5652697060**（本轮 REST 实读：`author_association: OWNER`、
  `created_at = updated_at = 2026-09-13T10:24:57Z`、零编辑——仅授权 schema 无关 W1 seam-1 在 ADR-0027 T1/T2 之前
  开工与合入，明确排除 W2 #369 / W3 #370）、AC1–AC6、SA6 验收契约、ADR 0028/0024/0016/0008 规范面
- 纪律：只审实现对 Issue/Owner/AC 的忠实性与范围；通用架构风格与仓库规范归 SA9；不改代码/设计/测试、不跑测试、
  不起服务；唯一产物 = 本文件

## Verdict

**approve** —— 六条 AC 全部由已提交实现满足且有行为测试锚定；Owner override 范围纪律精确（仅 W1 seam-1、
纯加法、schema 无关，W2/W3 零涉及）；两处解释性钉死（D3 数组面值键总序、D8 `PATH_NOT_ALLOWED` 透传）与
pins 观察面完成均经 SA8/SA2/SA7 治理链裁定与动态复核，非未达成项；**无遗漏、无部分实现、无错误实现、
无 scope creep**。PR 必须披露的解释项与流程项见 §5（披露不阻断 approve）。

## 1. 变更面与范围核对（Owner 评论 5652697060 逐条）

提交 `1b13e7c` 变更 = 13 文件 3786 行**纯加法、零删除**：`packages/doc-runtime/src/window.ts`（新建 747）、
`src/index.ts`（+19：2 值导出 + 13 类型导出）、`test/issue-368-window-read-contract-red.test.ts`（SA6 契约 816，
未改动原样入库）、`test/issue-368-window-read-design-pins.test.ts`（SA1 必选 pins 357）、
`test/public-surface-guard.test.ts`（+16：P-W1/P-W2 逐导出记账）、`test/public-surface-type-guard.test-d.ts`
（+68：13 类型名目 + 4 条编译期负例）、wiki 产物 7 件。

| Owner 条款 | 实测结果 | 证据 |
|---|---|---|
| 仅 seam-1（#368 全部验收面，schema 无关） | ✅ 改动仅及 doc-runtime；排序比较的是实际数据原始值（`classifySortKey` typeof/`Number.isFinite` 级），零 schema 通道 | `git diff 36a73bb..HEAD --name-only`：packages/docs/CONTEXT 中非 doc-runtime 路径 = 0；window.ts `drillField`/`classifySortKey` |
| 纯加法 | ✅ `read.ts`/`carrier.ts`/契约测试文件 **0 行 diff**；`docs/**`、`CONTEXT.md` 零接触；零删除 | `git diff --numstat`（read.ts/carrier.ts = 0 行）；提交 stat 全 `+` |
| W2（#369）排除 | ✅ 无 lease 层 `readArray`/`readMap` 公共面、无四键 `{ok,value,schema,truncated}` 结算、无 `kept/total`/`truncated`/✂ 投机字段、无 registry 透传、无类型别名；成功面**恰两键** `{ok,value}`（pins P7 锚定） | `namespace-runtime`/`namespace-registry` 零 diff；window.ts 装配段 L205–208；pins P7 |
| W3（#370）排除 | ✅ 无元素口径投影文本、无 schema 通道、无 lease 生命周期面；`packages/vfsl` 零接触 | diff 面；ADR-0027 仍缺席（`docs/adr/` 无 0027 文件） |
| T1/T2 前开工与合入（挂 PR #367） | ✅ 实现落在 `mabf/issue-368`（ahead of `origin/adr0028-window-read` by 1）——override 授权的正是此时序 | git log/status；SA8 iter2 §4 override 表 |

## 2. Issue AC ↔ 实现/测试锚定（逐条）

| AC | 实现落点（window.ts） | 行为锚 | 判定 |
|---|---|---|---|
| AC1 选窗正确性矩阵（基 × dir × 类型组序 × 不可比尾组 × 平局稳定锚，公共入口行为断言） | `classifySortKey`（组 0 有限 number / 组 1 string / 组 2 不可比）+ `compareSortKeys`（组间序恒定、dir 仅翻转组内序）+ `compareCandidates`（身份 asc 恒定锚，键面复用 `compareCodePoints` 码点比较器） | 契约 A1–A8（数组面，Y.Array + plain 同构 A6）、B1–B3（键基）、C1–C4（field 基）、H1（确定性）；pins P2/P2b/P8 | ✅ |
| AC2 零物化哨兵（未入选子项埋 non-finite/稀疏空洞必须 `ok:true`） | 枚举只原始读（`enumerateArrayCandidates`/`enumerateMapCandidates`/`drillField` 恰一次单段下钻），物化仅限前 `min(n,N)` 入选项（M 循环） | 契约 F1–F5（含 N=2000 规模哨兵）+ NC5（哨兵有牙：同毒值经姊妹全量物化必 `PATH_NOT_ALLOWED`） | ✅ |
| AC3 条目列表形态（身份随行、呈现序 = 有序基之序、空容器 → `[]`） | 条目字面量 `{index,value}`/`{key,value}` 构造，值 = 姊妹逐项投影（不含容器壳） | 契约 D1–D5（own 键集恰两键、四形空容器 → `[]`、`__proto__` 敌意键免疫 + 零原型污染） | ✅ |
| AC4 组合式 depth 等价（入选项 ≡ 同预算逐项读逐字节一致） | `materializeItem` **字面调用公共姊妹** `readLogicalValueAtPath(doc, [...path, 身份], 预算|两参)`——等价锚由构造保证 | 契约 E1–E5（`maxChildrenPerNode` 只治项内部、终点宽度由 n） | ✅ |
| AC5 三失败码各就各位 + 敌意 options 零外抛 | `WINDOW_TARGET_ABSENT`（navigate 缺席位改判响亮、不吸收）/ `WINDOW_CARRIER_MISMATCH`（C 面闭集检查）/ `WINDOW_OPTIONS_INVALID`（D9 封闭 descriptor 校验：未知键/accessor 零执行/Proxy trap try 收编/n≥1 有限整数/face 词表） | 契约 G1–G8（三码互异、n 边界全枚举、语境外排序项、G6/G7 `accessorRuns === 0` 且不抛）；pins P5/P6 | ✅ |
| AC6 doc-runtime typecheck + 既有测试全绿；root typecheck/test 绿 | 公共面纯加法 + 守卫两文件逐导出记账（P-W1 存在性/函数形态、P-W2 命名空间恰两枚防别名；类型守卫 13 名目 + 4 负例 fail-closed） | SA3 实测：root `pnpm test` **380 文件 / 4445 用例全绿 exit 0**、root typecheck exit 0；SA7 独立复核：契约+pins 56/56、包级 729 绿、tsc exit 0、post-removal 结果不变 | ✅（证据链，SA10 不跑测试） |

## 3. 规范面符合性（ADR 0028/0024/0016/0008）

- 决策 2 WindowTerm 闭合联合、dir 缺省 asc、v1 face 词表、词表外响亮拒绝 ✅（`validateOrderBy`：判别键恰现其一、
  `by ∈ {index,key}`、`field` 须单段 string、数组面拒 `field`/`by:'key'`、键面拒 `by:'index'`、列表/非标量形状拒）。
- 决策 3 条目两形/身份随行/呈现序硬/敌意键免疫/空容器 `[]` ✅。决策 4 组合式 depth ✅（逐项字面调姊妹）。
- 决策 5 总序（number → string 码点 → 不可比恒尾、组间序恒定、锚恒 asc）✅（D10 码点比较器新建，非码元序、
  非 localeCompare）。
- 决策 7 三码逐字、响亮不抛、敌意校验零外抛零 accessor 执行 ✅。决策 8 成本纪律 ✅（O(N) 枚举 + 每 child 一次
  单段下钻 + 只物化入选项；O(N log N) 排序经 SA8 iter3 #8 裁为非禁令外义务）。
- 决策 9：doc-runtime 载体级、schema 无关 ✅；readData/ADR-0024 options 零改动 ✅（NC2 锚定，read.ts 零 diff）；
  姊妹 `readLogicalValueAtPath` 签名/语义逐字不变 ✅（NC1/NC3 锚定）。ADR 0016 L82 / ADR 0008 L20/L229 冻结面保持。
- ValueSchema 9-kind / wire / 持久化 / 诊断日志：零接触 ✅。
- `packages/doc-runtime/AGENTS.md` 公共面纪律（新导出仅经 `src/index.ts`、守卫逐导出记账、公共类型变更跑
  root typecheck/test）✅ 全部兑现。

## 4. 解释性钉死（经治理链裁定，非未达成项）

1. **D3 数组面 `by:'index'` = 项值总序 + 下标 asc 锚**（非字面容器下标序）：ADR 注释「asc = 自 [0] 取」与决策 5
   总序机制的张力，SA8 iter3 #2 裁 **no-conflict**（前缀读法调和）；issue 自身「平局按 key/下标 asc 恒定」
   （纯索引序永无平局、该句只在值键排序下有效）与 AC1 矩阵（类型组序须在数组面可测）支持此读法；SA6 已验收
   契约 A1–A8 钉值键序。实现与裁定一致。
2. **D8 `PATH_NOT_ALLOWED` 为窗口可观察第四码（投影域透传）**：issue「三失败码」枚举的是窗口域失败；入选项
   物化失败/导航纪律位/E100 复用姊妹既有码透传（fail-fast、无半窗、无静默跳项、无补位），三枚 `WINDOW_*` 码
   语义逐字保持。SA8 iter3 #7 裁 **no-conflict**（空白处唯一不吞错读法、不发明第四窗口码）；pins P1/P6b 直测，
   SA7 突变探针（静默跳项）实证有牙。
3. **D4 non-finite 排序键归不可比尾组**（ADR 决策 5 枚举空白）：SA8 iter1 注记 3 移交 SA1 钉死；设计记录 +
   pins P2/P2b 双锚定（插入序打乱 + 两方向组位不变）；SA7 突变探针（归 number 组）实证有牙。
4. **D5/D6/D7 空白填充**：field 单段字面键（点号不拆分、空串合法）、undefined 值键出条目空间、空路径 `[]` =
   ROOT、detached → `PATH_NOT_ALLOWED`——全部沿姊妹既有纪律同构，pins P3/P4/P5/P6 锚定，SA8 iter3 #16/#17
   裁 no-conflict。

## 5. PR 必须披露项（不阻断 approve）

| # | 披露项 | 性质 |
|---|---|---|
| 1 | 窗口读在 doc-runtime 层的可观察失败联合含第四成员 `PATH_NOT_ALLOWED`（投影域透传，D8）——超出 issue「三失败码」字面，三枚 `WINDOW_*` 码语义逐字未动；经 SA8 iter3 #7 裁定、SA2 approve、SA7 动态复核 | 规范解释（已裁） |
| 2 | 数组面缺省/`by:'index'` 的操作语义 = 项值类型组总序 + 下标 asc 平局锚（D3），与 ADR 行内注释「asc = 自 [0] 取」按前缀读法调和；若 Owner 后续改采纯索引读法，须改契约 A 组 + 实现并重开冲突复查（SA8 iter3 §8-4 条件触发路径已登记） | 规范解释（已裁，含回转路径） |
| 3 | pins P2/P2b 对 D12 期望序列采用等价观察面（`depth:0` 折叠 / 可物化前缀 + 尾组首项 fail-fast 身份）——D12 字面全序列因 fail-fast 不可作 `ok:true` 观察；SA7 交叉验证为忠实等价（语义断言零改动）；SA1 回写 D12 观察纪律文本 = 非阻塞 follow-up | 设计记录缺口（已复核） |
| 4 | SA4 实现评审产物（`task_issue-368_sa4_review.md`）在最终交付时不存在；SA7 已在报告中明示并独立完成动态验证 approve。无 SA4 reject 在案 | 流程披露 |
| 5 | non-finite 归尾 / field 字面键 / undefined 值键 / 空路径 / detached 等钉死项以设计记录 + pins 可执行锚双锚定，未回写 ADR/CONTEXT（override 路径零文档改动方针；Owner 若改走词条回写按 SA8 iter2 §7-2 对账） | 文档面披露 |

## 6. 次要观察（MINOR，不阻断）

1. G0（非数组 path）/N0（ROOT 非 Y.Map）纪律位无 pins 专锚——SA2 非阻断观察 1：无 `ok:true` 伪绿通道
   （E100 镜像收敛同码），实现与设计定序一致（SA7-A6 实测 G0 先于 OPT）。
2. P3 fixture 载体形态未显式点名（实采用 Y.Map；field 基两形态同构，契约 A6/B3 已互证）。
3. `window.ts` 复制件 9 件带 `copied from read.ts@36a73bb` 出处标记（SA2-F4 落实）；read.ts 冻结解除时的
   抽共享模块消复制为已登记 follow-up。

## 7. 复核方法与取证

- 全文实读：最终 diff（`git show 1b13e7c` / `git diff 36a73bb..HEAD`）、`window.ts`（747 行）、契约测试
  （816 行，45 用例 = 39 契约 + 6 负控逐组核对）、pins（357 行，P1–P8 期望值独立重算无误）、守卫两文件 diff、
  ADR 0028 全文、SA6 契约/SA1 设计（680 行）/SA2 评审/SA3 实现报告/SA7 验证报告/SA8 三轮门禁报告/决策摘录。
- REST 实证（本轮）：Owner 评论 5652697060（id/OWNER/created=updated=2026-09-13T10:24:57Z/正文范围逐字）；
  issue #368 open、comments=1、正文头与简报一致、updated 10:26:53Z 非正文编辑。
- 范围实测：`git diff 36a73bb..HEAD --name-only` 全枚举；read.ts/carrier.ts/docs/CONTEXT/namespace-*/vfsl
  零 diff；纯加法零删除。
- 测试绿证据转引自 SA3（root 4445 绿）与 SA7（独立复核 + 突变探针 + post-removal 复跑）——SA10 纪律不跑测试，
  动态验证归 SA7 职域，其 verdict 为 approve 且含 sha256 还原一致性证据。
