# SA9 标准审查 — issue #382：[ADR 0029] P2 `where` 过滤原语（缝 1：doc-runtime）

- 角色：SA9（独立 Standards 审查者）；dispatch `sa-83757e3f-24d6-4f01-8746-8121c2b84d77`；iteration 0。
- 被审对象：worktree `/home/wangjian/nomicore-fix-issue-382` 已提交最终 diff `1b639e0..03a58c6`（HEAD `03a58c6f38bb09334bb05808779d2611ed786d25`，`feat(doc-runtime): add where window filters`）。
- 基准：Parent PR #380 权威 base `1b639e0ebe825ffbbfce377850c01ef620734f47`（已刷新且稳定；本评审 `git rev-parse` 复核 HEAD 父提交恰为该 sha）。
- Owner 评论：REST 快照为空——无适用 owner 要求、comment ID 或时间戳；与简报 Comments 段、SA2 §4、SA4 §1、SA6 §2、SA8 三方记录一致。
- 方法声明：SA9 全程只读（源码、diff、ADR、AGENTS、CONTEXT.md、wiki 产物、artifacts 日志）；**未运行测试/服务/探针、未修改任何代码/设计/测试、未调度其他 SA、未 commit/push/PR**；所有「绿」结论为 artifacts 日志静态复核 + 结构断言独立重算。唯一写产物 = 本文件。
- 职责边界：只判断实现是否符合仓库工程标准（AGENTS/ADR/模块责任/架构惯例/单一事实源/生命周期对称/文件范围/测试质量）；Issue 需求完整性属 SA10，不在本评审范围。

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| 简报 `wiki/raw/task_issue-382.md`（AC1–AC8） | 在场 | 通读 |
| 设计 `wiki/raw/task_issue-382_design.md`（SA1 iteration 1，含 §11 ALLOW/DENY） | 在场 | §7/§8/§11 逐项对照 diff |
| SA2 `…_sa2_review.md`（approve，R-1–R-4 MINOR） | 在场 | 落实核对 |
| SA3 `…_sa3_impl.md` | 在场 | 与实际 diff/日志逐项对账 |
| SA4 `…_sa4_review.md`（approve，6 项 MINOR 观察） | 在场 | 独立复核其主张（非转抄） |
| SA6 `…_sa6_contract.md`、SA8 三份冲突报告（均 clear） | 在场 | 义务面核对 |
| `docs/adr/0029-filtered-window-read.md`（规范权威）、`docs/adr/0028-window-read.md`、CONTEXT.md L61–67 | 在场 | 全文/词条通读，逐条款对照实现 |
| 根 `AGENTS.md` + `packages/{doc-runtime,namespace-runtime,namespace-registry}/AGENTS.md` | 在场 | 边界条款逐条对照 |
| 提交 diff（8 文件：3 src + 2 迁移测试 + 3 新测试） | — | `git diff 1b639e0..HEAD` 全量逐 hunk；冻结面独立重算 |
| 12 份 `artifacts/sa3-issue382-*.log` | 在场 | 关键日志尾段/双态证据静态复核 |

## 2. Verdict

**`approve`**（无 BLOCKER、无 MAJOR；5 项 MINOR/观察项入 §6，均不阻断）。

核心结论：提交 diff 是 ADR 0029（accepted 规范权威）与设计 iteration 1 在工程标准维度的忠实落地——模块分层（W1 载体机制 / 组合层纯组合 / lease 零校验透传）、冻结面（read.ts 零 diff + sha256、17 个冻结函数体逐字节 SAME、S3 判据体未放宽）、单一事实源（total W1 A 阶段单点、失败构造 `windowFailure` 单源、`drillField` 复用、B-8 结果键位判据）、生命周期零触点、ALLOW/DENY 文件范围精确、测试质量（#368 家族先例 + 独立预言机 + 负控有牙 + 集中化形状断言门）全部达标；仓级机械门（typecheck 14 工程 / 396 文件 4827 用例）exit 0 证据在场。

## 3. 标准逐项审查

### 3.1 仓库 AGENTS 与模块责任边界

| 标准 | 证据 | 判定 |
|---|---|---|
| 根 AGENTS「Module guidance：改 packages/ 前读最近 AGENTS.md」 | 三模块 AGENTS 边界逐条对照实现（下四行） | ✅ |
| doc-runtime「Keep reads schema-independent」 | `whereMatches`/`matchesWhereTerm` 只消费 `drillField` 载体原始值；全链零 schema 触碰（ADR 0029 §7） | ✅ |
| doc-runtime「Keep carrier mechanics here，persistence/lifecycle sequencing 归 namespace-runtime」 | 过滤内联于 `window.ts` 枚举循环（E+W 阶段）；组合层只收签名加宽 + 入口分支，无过滤逻辑 | ✅ |
| doc-runtime「Add public APIs only through src/index.ts；public-surface guard tests must account for every export」 | `WhereTerm` 经 `index.ts` **type-only** 导出（并入既有 `export type` 块、字母序 `'Wh'<'Wi'` 正确）；`public-surface-type-guard.test-d.ts` M2 记账（导入/声明/投影断言）；NC6 断言运行时 /Window/ 值导出恰两枚且 `WhereTerm` 不在运行时键空间 | ✅ |
| namespace-runtime「Reads stay outside that sequencer」「Public APIs expose detached projections only」 | 全链同步纯读、零状态、零 sequencer 触点（src diff grep subscribe/observe/memo/cache/timer 零命中） | ✅ |
| namespace-registry「lease 零校验透传」「Add public APIs only through src/index.ts」 | `lease.ts`/`types.ts`/`index.ts` 零 diff（别名链自动透传 `where?` 类型）；lease 面中间态响亮由组合层 D8 分支承担 | ✅ |

### 3.2 ADR 符合性（规范权威与被保留契约）

| ADR 条款 | 实现证据 | 判定 |
|---|---|---|
| ADR 0029 §1（options 增可选 `where`；不新增第四读方法；不改 readData） | 两面 options 各增 `where?: readonly WhereTerm[]`；`readArrayWindowAtPath`/`readMapWindowAtPath` 两入口不变；`read.ts` 零 diff；NC4 钉姊妹 `READ_OPTIONS_INVALID` | ✅ |
| ADR 0029 §2（WhereTerm v1 恰两键、单段字面键、标量闭集、finite 门、合取、空数组非法、上限 16、同 field 重复合法、形状永不再变） | `WhereTerm` 类型 + `WHERE_TERM_LIMIT = 16` 具名哨兵单点；W-4–W-12 判据全在场（`validateWhere`/`validateWhereTerm`/`validateWhereEquals`）；V1–V10/V16 锚定；无 in/范围/OR/NOT/多段/深相等入口 | ✅ |
| ADR 0029 §3（数据侧安静不匹配 × 入参侧响亮） | `drillField` undefined ⇒ 不匹配；`matchesWhereTerm` typeof 闭集门 + finite 门 + 严格 `===`；D1–D12 含 equals:null 双向与 accessor 计数器 `=== 0`（D7） | ✅ |
| ADR 0029 §4（管线 where → orderBy → n；readArray 对称获得；不触碰 orderBy 词表） | E+W 内联过滤在 S（排序）前、M（物化）前；P1 断言「排序→取 n→过滤」变异必红；`validateOrderBy` 函数体 sha256 SAME（本评审独立重算）；C8/V18/NC5 词表负例 | ✅ |
| ADR 0029 §5（total 键恒在：无 where = 标识计数；有 where = undefined 恒不承诺） | A 阶段单点三分支字面量构造 `{ok:true, value, total: where===undefined ? candidates.length : undefined}`；T1–T5 以 `hasOwnProperty` 判 own 键（禁 JSON）；类型锁 M1/Y3 加宽 `number \| undefined` | ✅ |
| ADR 0029 §6（敌意校验：两键白名单、plain 原型链、零 `[[Get]]`、零 accessor 执行、trap 收编；W1 权威 + S3 镜像两层同步扩；三码族复用） | 全 descriptor 读（含 length/逐下标）、双层 try + E100 backstop、防御性浅拷贝；V9–V17 计数器/反例锚定；S3 `canonicalWindowBudget` 白名单仍**恰四键**（L230 逐字节未动）——镜像扩展正确留缝 2（SA8 A2/DR-11 已裁决）；零新失败码 | ✅ |
| ADR 0029 §8（W1 原地扩；S4 下沉后组合层零计数零重算） | `window.ts` 原地扩（新增 src 文件 0）；组合层仅签名/分支/注释，`total` 直通无重算；镜像出处标记 10 → 10 不减 | ✅ |
| ADR 0028（排序总序/平局锚/三稳定码/零物化/分层归属） | S/M 阶段零改动；`compareCandidates`/`materializeItem` 等 12 个 window.ts 函数体 SAME；F1–F6 三码各就各位 + PATH_NOT_ALLOWED fail-fast 无半窗；Z1–Z8 零物化哨兵（N=2000） | ✅ |
| ADR 0027（lease 恒四键；「结算加第五键 total」已否决） | compose 成功面构造零改动；P4 负控 `'total' in result === false` | ✅ |
| ADR 0024（预算结构盲；值感知选择不进 readData options） | `read.ts`/`runtime.ts` 零 diff；where 零渗入预算通道 | ✅ |
| ADR 0002（authority 排除；where 为机制非策略） | 谓词无领域语义、无规则引擎形状 | ✅ |
| ADR 0008（读不重编译/重校验 VFSL；读不进 sequencer） | 全链同步纯读、零生命周期触点 | ✅ |
| ADR 0023（冻结服务对象构造纪律） | 不触碰任何服务对象构造 | ✅（无关面） |

### 3.3 既有架构惯例

| 惯例 | 证据 | 判定 |
|---|---|---|
| 复制镜像纪律（`read.ts` 冻结面 + 出处标记） | `git diff --stat -- read.ts` 空；sha256 `3bf6b8b0…b1b312` 与设计/SA6 登记值一致（本评审独立重算）；`copied from read.ts@36a73bb` 标记 10 → 10 | ✅ |
| 接缝终态构造先例（`seamWindowOptionsInvalid` 同款四键纪律） | 新私有构造器 `seamWhereNotImplemented` 复用本模块单源 `windowFailure`（恰四键 `{code,ok,path,message}` + `safePathCopy`），未在 runtime.ts 另造窗口失败面 | ✅ |
| options 封闭形状 descriptor 校验先例（`validateWindowOptions`/`canonicalWindowBudget`） | W-1–W-14 同款纪律推广到 where 轴（descriptor 读 length/逐下标、accessor 拒、try 收编）；非第三套校验器——D8 分支不重读 options、不校验形状 | ✅ |
| 集中化形状断言门（issue #333/#336/#364 family B 零字面量） | registry 新测试经 `expectReadDataOkKeys` 集中化 helper 断言恒四键；跨包相对导入 `../../namespace-runtime/test/helpers/readdata-ok-shape.js` 有 5+ 处既有先例（registry-open/registry-sa7/#369 等） | ✅ |
| issue 号契约测试家族先例（#368/#369：contract-red + type-guard + 独立预言机 + NC 组） | 新三文件同形态：`import * as docRuntime` + §绑定 常量 + native/Yjs 直数预言机（零实现复用）+ NC1–NC8 负控 | ✅ |
| 类型面 fail-closed 先例（`.test-d.ts` + `@ts-expect-error` 负例） | Y1–Y4：可导入/投影/total 加宽/键集锁/七枚 `@ts-expect-error`（闭集外 equals、未知键、非数组 where、语境外 orderBy） | ✅ |

### 3.4 单一事实源

| 事实 | 权威源 | 派生/消费 | 漂移风险 |
|---|---|---|---|
| 候选/匹配计数（total） | W1 A 阶段单点（E 段同一次枚举产出） | compose 直通；S6 零重算；runtime.ts L691/L703 直传无 cast/兜底 | 低 ✅ |
| 「where 是否已生效」 | W1 结算结果 `total === undefined`（B-8 不变量） | D8 入口分支判据（键于结果而非 options 重读——对敌意视图漂移免疫；探针双态实证） | 低 ✅ |
| where 词表形状 | ADR 0029 §2（终态） | 类型面 + W-4–W-12 判据；无第二词表 | 低 ✅ |
| 窗口失败构造 | `windowFailure`（window-read.ts 单源） | `seamWhereNotImplemented`/`seamWindowOptionsInvalid` 复用 | 低 ✅ |
| 单段下钻 | `drillField`（orderBy field 基既有件） | `whereMatches` 直接复用——同能力无双协议 | 低 ✅ |
| 16 哨兵 | `WHERE_TERM_LIMIT` 具名常量单点 | 判据与 message 同消费 | 低 ✅ |

### 3.5 生命周期对称性

纯读路径：零资源获取、零订阅、零 timer、零 sequencer 触点（src diff grep 证实）；无 acquire/release 新增对、无 close/shutdown 语义触碰。registry P4 测试自身 `withLease` finally 中 `lease.release()` + `registry.shutdown()` 对称清理。无不对称项。✅

### 3.6 文件范围（设计 §11 ALLOW/DENY）

| 检查 | 结果 |
|---|---|
| changed set = 恰 8 文件（3 src + 2 迁移测试 + 3 新测试） | 与 ALLOW 行 1–8 一一对应 ✅ |
| `window.ts` 改动位点 | 仅限类型面/OPT 校验/E+W 过滤/A 阶段/注释——DENY 列举的相邻冻结逻辑（`validateOrderBy`/`navigate`/`compareCandidates`/`materializeItem`/`readableOwnDataValue`/`readableArrayElement`/`isPlainRecord`/`classifySortKey`/`compareSortKeys`/`compareCodePoints`/`safeSpreadPath`/`windowFailure`）12 件函数体 sha256 全 SAME（本评审独立重算） ✅ |
| `window-read.ts` 改动位点 | 仅限签名加宽/入口分支/新私有构造器/注释；`canonicalWindowBudget`/`canonicalOrderBy`/`windowFailure`/`safePathCopy`/`seamWindowOptionsInvalid` 5 件函数体 SAME ✅ |
| DENY 全域 | `read.ts`（零 diff + sha256）、`runtime.ts`/`lease.ts`/`types.ts`、#368 pins/#381/surface-guard/#369 全部测试、`CONTEXT.md`、`docs/**`、`vitest.config.ts`、`package.json`、`tsconfig*.json` —— `git diff --stat` 全空 ✅ |
| 迁移面精确性 | M1（total 钉加宽 + 注释）/M2（WhereTerm 记账）/M3（#368 头注 2 行注释级，零断言改动）diff 亲证；M4 零改动文件未触碰 ✅ |
| 新测试采集 | 命名落既有 include 模式（`packages/*/test/**/*.test.ts` / `*.test-d.ts`），零配置改动 ✅ |

### 3.7 测试质量标准

| 标准 | 证据 | 判定 |
|---|---|---|
| 零 skip/only/todo/xit/xdescribe | 三新文件 + 两迁移文件 grep 零命中 | ✅ |
| 零 env override / 零 fallback / 零吞错 / 零源码字符串断言 | 头注纪律声明 + 断言全锚运行时行为（结果联合、own 键集、条目身份与值、计数器） | ✅ |
| 独立预言机（防同源性伪绿） | `arrayOracle`/`mapOracle`/`arrayMatchesOracle`/`mapMatchesOracle` 纯 native `get`/descriptor 直数，零实现复用 | ✅ |
| own 键判定纪律（禁 JSON 快照） | `totalOf` 一律 `Object.prototype.hasOwnProperty` | ✅ |
| 负控有牙 | NC8 经姊妹全量物化证同一毒值确实响亮（`PATH_NOT_ALLOWED`），排除 Z 组假绿；NC4 钉 readData 冻结；NC6 钉值导出面；NC7 钉确定性 | ✅ |
| 红灯基线证据（TDD 红） | `red-contract.log`（src 还原 HEAD 后 44 failed/32 passed，红因 = 词表位缺席）；`type-red.log`（TS2305/2353/2339/2344/2578）；V 组伪绿按 SA6 §12.3.3 登记不充当红证据 | ✅ |
| 仓级机械门 | `full-test.log`：396 files / 4827 tests passed、`Type Errors no errors`、exit 0；`root-typecheck.log`：14 工程 exit 0；`package-typecheck.log`：三受影响包 exit 0 | ✅ |
| 敌意面行为级证据（SA8 A6′） | D8 变异探针双态：变异态观测到静默已过滤成功面（`ok:true truncated=false keys=["t3"]`，探针有牙）∧ plain 对照仍拒；还原态 `ok:false WINDOW_OPTIONS_INVALID` ∧ `ownKeysCalls=1`；纯删除变体 `tsc` exit 2（编译期第二道）；临时探针文件零残留（find 零命中） | ✅ |
| 条件不变式耐久形态（不写会随缝 2 腐烂的严格断言） | registry P4 三用例：ok:true ⟹ 条目全满足谓词；ok:false ⟹ 码 = `WINDOW_OPTIONS_INVALID`；无 where 四键基线负控 | ✅ |

## 4. 上游要求落实核对

- 简报 AC1–AC8：逐条有实现 + 契约测试锚（见 §3.2/§3.7）；「位置序短路」按 SA6 §7/H8/O3 已批准裁定以可观测等价兑现（P5/Z5 锚），设计 §13 Follow-up ② 口径注在案——非静默偏离。
- SA2 R-1–R-4（全 MINOR）：R-1 消费点收窄 + 失败构造单源 ✅；R-2 行为级双态证据 + S4 增补检查位 ✅；R-3 契约文件零跨包 import ✅；R-4 短路口径注 ✅。
- SA8 A1–A5 / A1′–A4′ / A6′ / F1–F8：逐条保持（§3.2/§3.3）；三份冲突报告均 `clear`。
- Owner 要求：无（REST 快照为空，五方记录一致）——无遗漏。
- 基准一致性：HEAD 父提交 = 权威 base `1b639e0ebe825ffbbfce377850c01ef620734f47`，diff 范围即 `1b639e0..03a58c6` 单提交。

## 5. Required revisions

无 BLOCKER、无 MAJOR。**无必须修订项。**

## 6. Non-blocking observations（MINOR，不阻断 approve）

- **OBS-1（证据落盘，过程项）**：`artifacts/sa3-issue382-*.log`（12 份）当前 untracked；仓内 `artifacts/` 有 70 份 git tracked 先例（含 `sa3-issue381-*`）。A6′/S1–S4 证据链不随仓存活即不可复核——建议 Controller 随本票同提交纳入（与 SA4 OBS-4 一致；非源码范围违规）。
- **OBS-2（测试组织）**：契约文件 T 组以 5 个 `it` 覆盖 SA6 表格 T1–T6（T4/T6 合并，断言集同点）——覆盖等价、无弱化（与 SA4 OBS-1 一致）。
- **OBS-3（敌意面判别力）**：V13/V14（四 trap 抛异常 Proxy）只断言「响亮 ∧ 零外抛」，不区分「零 `[[Get]]`」与「`[[Get]]` 收编」——SA6 规格本就只要求前者；零执行判别由 V11/V15/D7 计数器 `=== 0` 承担，防线完整（与 SA4 OBS-2 一致）。
- **OBS-4（遗留 label）**：`issue-381` T9c 用例 label「未知键」语义过时（`{n:1,where:'x'}` 新拒绝因 = 非数组，断言仍同码绿）——设计 R-6 已裁观察项，M4 零改动纪律优先（与 SA4 OBS-3 一致）。
- **OBS-5（哨兵提醒）**：`WHERE_TERM_LIMIT = 16` 为 ADR 0029 §2 登记的实现票可调哨兵——后续调整须先改 ADR/简报口径，不得静默偏离；现行值与简报 AC3「16 合法 / 17 非法」一致（V2/V3 锚定）（与 SA4 OBS-6 一致）。

## 7. Deferred（非本票标准审查范围，登记备查）

- 缝 2 义务（lease 面 `where` 接收、truncated 双语义、✂ 永不装配、S3 镜像扩展「两层同步扩」）属后续票，PR #380 阶段收官前闭合；届时 D8 分支被整体取代、P4 条件不变式无需退役。
- SA6 §12.7 其余 13 类变异的动态击穿复核（静态已核对每类存在对应击穿用例）。
- CI 首跑（push 后 typecheck + test 分片）。
- 位置序成本短路（Follow-up ②，触发 ~10⁵）。

---

SA9 未修改任何代码、设计或测试；未运行测试/服务/探针；未 commit/push/创建 PR；未等待或调度其他 SA；唯一写产物 = 本文件。
