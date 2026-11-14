# SA8 实现级冲突复查 — issue #471：Cordis rc.12 Hub/Peer/SessionHost 全链兼容（implementation 复查）

1. **Reviewed subject**: implementation（实际 diff 对 `d59a4d1`：3 tracked 修改 + 7 新增实现文件；SA3 报告 `wiki/raw/task_issue-471_sa3_impl.md` iteration 1）。SA8 dispatch：`sa-9245240f-78e0-42f5-a128-70443dafb186`，iteration 0，phase conflict-gate。本会话只读裁决（唯一写入 = 本报告与 `/tmp` 对账脚本；**未运行任何测试/vitest/tsc**——全部结论来自 git 只读命令、磁盘证据文件（`.cache/`）解析、源文本实读与 python 多重集对账）。
2. **裁决基准（钉死值全集）**：本报告前身的 iter-0 §9（十文件 ALLOW/T-1/T-2/T-3/T-4/B-1…B-5/§9.3 十二条）、iter-1 §12（E-增补授权、T-1a、X-1）、iter-2 §13（§9.2 rev 2 钉死、I-1/I-2/I-3）、iter-3 §14（rev 2.1 追认、**I-1@rev2.1 对账基线**：`cat_1=19 cat_2=13 cat_3=7 cat_5=4 cat_5DR=196 cat_5DC=46 cat_6=0`、285 条、token `snap`/`input2`、3→5 迁移两行）。
3. **输入缺口（如实记录）**：dispatch 点名的同组评审 `wiki/raw/task_issue-471_sa4_review.md` **不在 worktree**（glob 全仓无此文件）。本裁决不依赖该文件；最终评审（SA9/SA10）路由时以其实际在场为前提。
4. **规范基准**：ADR 全集 + CONTEXT.md（同 iter-0 §1，未变——本轮零触碰 `docs/**`，G7 PASS 佐证）。本轮被审对象全部为验收设施与测试文件，无任何 ADR/协议/生产面改动。

---

## 1. Inputs and decision set（本轮实读对象）

| 输入 | 核对方式 |
|---|---|
| 实际 diff（3 M + 7 ??） | `git diff --name-only d59a4d1`；`git status --porcelain`；逐文件 `git diff d59a4d1 -- <f>` |
| `gates.mjs`（423→821 行，+454/−28） | 全量 diff 逐 hunk 实读（`/tmp/gates.diff`）+ 终版源码实读 |
| `run-baseline.mjs`（870→1066 行，+238/−21 实为 +217/−21 净） | 全量 diff 逐 hunk 实读 |
| `baselines.json`（+14/−8） | 全量 diff 实读 |
| `root-test-known-red.json` | 全文实读（76 行） |
| 6 个新测试文件 | 定向实读（D-2 两族全文、channel fault 纪律头/断言、lifecycle `coverage` 自检、support helper env 面、ownership 4 例、dsh-profile 序断言） |
| `.cache` 证据 | `gates/gates.log`（289 条全量解析）、`matrix/{matrix.json,matrix.log,unit-union.json}`、`B{1,2,3}/*.json`、`root-test{,-base}/*`、`B3/fault-*.json`、`mutations/mutations.json`、`negative/N6-gates.log` |
| G10 BASE 锚点对账 | python 多重集比对：gates.log 的 BASE 文件子集（按 `git ls-tree -r --name-only d59a4d1` 分桶）vs `.cache/issue471-g10-dryrun/report-main.txt`（285 条），键 =（类, 位置, 形态, receiver/source/callee token） |

---

## 2. 逐项裁决（dispatch 项 1–7）

### 项 1 — ALLOW 守界（第一手）：**clear**

- **并集恰为 §9.1 十文件**：`git diff --name-only d59a4d1` = 恰 3 设施文件（baselines.json / run-baseline.mjs / gates.mjs = §9.1 条目 1–3）；`git status --porcelain` 非 wiki 新增 = 恰 7 文件（4 ws 测试/helper + ownership + dsh-profile-direct + 台账 = §9.1 条目 4–10）。无第 11 文件。
- **生产树零 diff**：`git diff --name-only d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` 输出 0 行（§9.3-1 前半）。复核命令：`git diff --name-only d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src' | wc -l` → `0`。
- **#470 已交付面零回改（逐文件零 diff，含 G2/G3/G12 机械承载）**：`plugin.ts`、`service.ts`、4 具名 fixture（`cordis-root-channel` / `cordis-root-real-timer` / `cordis-baseline-provenance` / `cordis-public-surface`，473f83e stat 核名）、4 冻结设施件（acquire/root-probe/provenance-b3/public-surface.base）、3 双读 fixture 与 guard-proxy-consumption——`git diff d59a4d1 -- <f> | wc -l` 全部 `0`（本会话逐文件跑）。G3 已从 allowlist 移除 `plugin.ts`/4 fixture（`gates.mjs:26–31` `WS_ALLOW_NEW_FILES` 恰 4 新文件），tracked diff 出现即 FAIL——D-5 反回退形态成立。
- **wiki/raw 与 .cache 定位**：untracked `wiki/raw/task_issue-471*.md` 7 件 = 任务过程工件（#470 PR #473 同类工件随票提交的既有先例，本报告自身亦属此类）；`.cache/` 经 `git check-ignore` 确认 gitignored。二者不属实现 ALLOW/DENY 的执法对象。**判定：文件级守界成立。**

### 项 2 — E-增补与新增实现代码的边界：**一项 reject（G10 M4 跨行 fail-closed 缺位），其余 clear**

**(a) gates.mjs +454 行逐编辑点核对（对 §7.3 G-清单 + E-增补授权 + §13.5/14.5 钉死值）**：

| 编辑点 | 授权源 | 实际 diff | 裁决 |
|---|---|---|---|
| BASE 重钉 `d59a4d1` | S5/§7.3 | `gates.mjs:41` | clear |
| G2 `assertAllowlist→assertNoChange`（三 src） | F-7（E-增补） | `:783–789` | clear（收紧） |
| G3 allowed = 恰 4 ws 新文件 | F-7 | `:26–31`,`:790` | clear |
| G6 `git diff --check BASE` | E-增补（SA2 §15-1） | `:772` | clear |
| G8 四类 src 全扫描 + 通道模式 + 2 行钉死 env | §7.3 G8 行（扫描面扩展授权）+ **D-3（本轮裁决，见项 6）** | `:43–58`,`:692–712` | clear（附 D-3 裁决） |
| G10 新增（R0/R1/R2/自证伪/自检） | §9.2 rev 2.1（§13.5 钉死） | `:343–675` | **一处 reject：M4 跨行实参位未 fail-closed（下详）**；余项 faithful |
| G11 五模式 + 空集 | §7.3 G11（T-2 空集钉死） | `:676–705`（`FORBIDDEN_API_ALLOW=[]`） | clear |
| G12 4 文件闭合白名单 + 目录内新增即红（changedPaths 并集） | §7.3 G12（I-2 钉死） | `:707–727` | clear（I-2 维持，见项 3） |

**G10 的 reject 点（唯一；降低门禁强度方向的未申报偏离）**：
- **事实**：`gates.mjs:430–441` `calleeOfLiteral` 与 M4 sweep 分支（`:547–560`）为干跑脚本 `scan.mjs:108–120` 的**逐字复制**——行内无 `(` 的 `'root'` 字面量返回 `null` 后 `continue` **静默按非候选丢弃**，包括「实参 `'root'` 与所属调用不在同一行」的跨行实参位形态（如 `Reflect.get(\n ctx,\n 'root')`）。而 §9.2 rev 2.1 R1 M4 钉死句（设计 L281，I-1③ 机械承载）明文：「实参位判定须覆盖跨行调用形态与被调点链空白形态……**无法机械归属所属调用时记为不可解析 ⇒ 候选 ⇒ 类 6（fail-closed），不得静默按非候选丢弃**」，且设计 L272 已把该局限点名列为「归 I-1③ 的 gates.mjs 落地义务」、并要求「落地实现按 M4 形态条款执行」。SA3 报告 §3/§4 的「G10 以 §9.2 文本语义落地（不照抄脚本）」主张与该点**不符**（恰好照抄了脚本被点名的那处局限），且未在 §8 披露。
- **影响量化（本会话第一手）**：当前树跨行实参位形态**零实存**（`grep -rnE "^\s*['\"]root['\"]\s*[,)]"` 于全扫描面 = 空；行内无 `(` 的 `'root'` 字面量仅注释/字符串内部 2 处），故 BASE 对账与 12/12 PASS **不受影响**——这是「通道洞」而非「现行命中漏判」。但钉死值的立法目的恰是封通道：经本票 ALLOW 文件（6 新文件）以多行形态写入 legacy 直读将不触红。
- **次生同向偏离（并入同一修复）**：`inVctx`（`gates.mjs:363–364`）的后缀正则 `(?:^|[a-z0-9_])(?:ctx|Ctx)$` 要求 ctx/Ctx 前一字符 ∈ `[a-z0-9_]`，较钉死文「以 `ctx`/`Ctx` 结尾」在 `ACtx`/`$ctx` 类 token 上**收窄候选集**（该类 token ⇒ 5D 而非类 6）。全树该类接收者零实存（定向 grep 空），BASE 对账不受影响；属同文件两行的字面对齐。
- **修复可满足性**：按钉死文最小机械形（行首实参续行形态——`'root'` 为行内首个非空白 token 且后随 `,`/`)` ⇒ 记 `callee=UNRESOLVED-CROSSLINE` ⇒ 类 6；case 标签/类型联合等非实参位仍为非候选）落地后 BASE 计数不变（零实存已证），对账基线不动。**修复落 §9.1 文件 3（gates.mjs）既有授权面内，无需 ALLOW 增删、无需设计修订。**

**G10 其余面 faithful（第一手核对）**：R0 扫描面 = `packages|apps|domains/*/{src,test}` + 设施目录排除（`:371`）；M1/M2/M3 形态、V_M4、cast 括 `inner[0]`（`:397–410`）、V_ctx 大小写敏感（`:363`）、类 5 `*`/`/*` 注释行（`:369–380`）、完整命中清单随 log 输出（`:662–667`）、seam 自校验（`:635–638`）、I-3 自检绑类+token（`G10_SAMPLES` 12 行，`:439–452`）与 15 探针（`:476–496`）均与钉死值一致。**自检表缺 4 行**（设计 §9.2 表 16 行中的 `service.ts:46`（类3）、`issue301:624`（类2）、`app.ts:880`、`[...root.keys()]` 非候选形）——均为排除类且被「cat_6 恒空」在 BASE 反向兜底（若 insideString/root( 判别劣化，这些行会翻成类 6 而 gate 红），故列**应修**（同一文件 4 行常量），不单列 reject。

**(b) run-baseline.mjs（+217/−21）对 E1–E7/E4a 逐点**：E1 常量组（`WS_LIFECYCLE_FILES` 双文件含 issue420、`GUARD_PROXY_FILES` 六文件、`UNLOAD_FILES`、`LIFECYCLE_UNITS` 23 名）✓；E2 `NEW_FILES` +7 ✓；E3 manifest 驱动白名单 + `'gates'` 死字面量删除（unknown-suite `fail('usage')` 保留）✓；E4 repeat=3（timers/lifecycle）、unload 双文件、r5p 回填保留 ✓（可选 `diagnostics` 字段未加——设计明文「可选」，非义务）；**E4a** `faultEnv()` 贯通全部 4 个 `runVitest` 调用点（`:585–587`/`:711`/`:749`/`:766`），env 名零新增（B-2 保持）✓；E6 `--all` 删 B1 专属 ws-package 块 ✓；E7 装载期 provenance→root-probe 自检 ✓。root-test cell 台账判定见项 4。
- **T-1a 语义（钉死）核对**：`LIFECYCLE_UNITS` = 21 个 `L.<entry>.<scenario>`（entry×scenario 笛卡尔积逐名生成）+ 2 补充 = 恰 23 名，与 iter-1 §12.2 项 2 第 1 款**逐名同集**；`observed` = 枚举内「在场且 passed」去重、`missing` = 枚举−在场、pass 要求 `observed===23` ∧ `coverage` 在场且 passed ∧ `foreignUnits===[]`（枚举外 `L.` 名 fail-closed）∧ `issue420` 在场（`run-baseline.mjs:690–711`）。**判据零降低**。
- **两处 Host 审阅强制的机械形态修正（RATIFY，语义保真）**：① units/coverage/foreign 提取改按 `assertion.title`（vitest 3.2.7 JSON reporter 的 `fullName` 以**空格**拼接 ancestorTitles、不存在 `' > '` 分隔符——设计 §8.1「全名 = `<标签> > L.…`」系事实性错误，原提取法恒得 observed=0）。钉定的是**枚举制判定语义**而非分隔符字形；title 即被钉死的每测试名。② guard-proxy `a64` 改文件级「在场 ∧ 该文件自身 exit0 ∧ 0 failed ∧ tests>0」（三文件标题为中文，设计「issue246/issue418 测试名在场且 passed」按英文字面永假——事实性不可满足；文件级全绿 ⊇ 名级在场且 passed，且 `cell.testNames` 保留全名清单可审计）。两处均为「钉死谓词按字面不可满足」的必要修正、方向更严，同 F-5r/F-6 家族，**追认为钉死语义的可满足机械形**。
- **设计文本内部瑕疵（记录，非违例）**：E1 写「`APP_COMPOSITION_FILES`（6 文件，§7.4）」而 §7.4 闭合清单实列 7 文件；实现 = §7.4 的 7 文件逐字（`run-baseline.mjs:105–113`），以 §7.4 清单为准。

**(c) baselines.json**：`base` 重钉 + `suites` 尾部追加 6 项（原 6 项顺序不动）+ comment 一句 ✓（§7.1 授权面）。额外 diff：多行 `§`/`—` 的 JSON 转义改写（`\u00a7`/`\u2014`）——`JSON.parse` 后字符串逐字符相等，integrity/dshCommit/probes **期望值零变化**（G12/G1′ PASS + 本会话 diff 核对），属序列化噪音，**不构成冻结值变化**（观察项，建议后续重序列化时收敛，非义务）。

### 项 3 — T-2 允许清单零增删 + G10 首落地对账：**clear（delta 解释逐条成立；对账读法正式追认）**

- **T-2 钉死值逐字在位**：`G10_LINE_ALLOW` 恰 5 行（`service.ts:86`、`plugin.ts:251`、`ws-replication-plugin:19`、`issue299-ac-red:171`、`issue422-listen-false:39`，`gates.mjs:350–356`）+ `G10_FILE_ALLOW` 恰 2 文件（`cordis-root-channel.test.ts`、`ws-replication-cordis-root-channel.test.ts`，`:357–360`）+ `G11` 空集 + `G12` 4 文件——与 iter-1 §12.2 项 3 / iter-3 §14.2 项 4 追认值**零增删**。复核：`grep -n "G10_LINE_ALLOW\|G10_FILE_ALLOW" -A 8 packages/persistence/test/fixtures/cordis-baselines/gates.mjs`。
- **I-1@rev2.1 对账（本会话独立复算，非采信 SA3 叙述）**：`gates.log` 289 条命中按「文件是否存在于 `d59a4d1`」分桶 → **BASE 子集恰 285 条，逐类 `cat_1=19 cat_2=13 cat_3=7 cat_5=4 5D-R=196 5D-C=46 cat_6=0`**；与干跑基线 `report-main.txt` 285 条做（类, 位置, 形态, token）**多重集比对：双向差集为空**——无类漂移、无 token 漂移、无 `receiver=undefined` 残留、3→5 迁移两行（`service.ts:41`/`plugin.ts:210`）与 token 两行（`snap`/`input2`）按基线复现。
- **delta 恰 4 条、逐条第一手核验成立**（新文件子集 {1:1, 3:2, 5D-R:1}）：`ws-replication-cordis-root-channel.test.ts:453` `Reflect.get(assembly.base,'root')`（类 1 = 文件级许可探针行的**记录**，非新增许可）；`cordis-baseline-support.ts:44` `Symbol.for('cordis.root')`（类 3 字符串内部）；`third-party-timer-ownership-red.test.ts:87` 测试名 `O.last-release.root-fiber-dispose`（类 3）；`ws-replication-cordis-root-timers.test.ts:212` `root: options.root ?? {n:1}`（5D-R 域键）。四条均为非红类，SA3 §5 表的「100% 由新增文件解释、BASE 锚点零漂移」**成立**。
- **对账读法正式追认（R-1）**：I-1@rev2.1 的「BASE 首跑」在实现态的操作义 = **BASE 锚点多重集全等 + 工作树新增命中逐条枚举且均为非红类**（gates 必须在含 ALLOW 新文件的合规树上运行——G3/G12 判定对象即该树；本会话以独立分桶复算履行了「在 BASE 上复现」的证明义务）。此读法为钉死条款的实现态释义，后续同型对账沿用。
- **I-2 联动核验**：G12 实跑 PASS（`gates.log:309`），4 冻结件零 diff（项 1 逐文件核）——G10 扫描面排除的合法性前提维持。

### 项 4 — T-3 台账合规（B-3a…e）：**clear（五绑定逐条第一手证据）**

| 绑定 | 证据（本会话复算） | 结果 |
|---|---|---|
| **B-3a** 来源冻结 | `root-test-base/ledger-capture.json`（baseHead=d59a4d1、baseCapture failedCount=32）；台账集合 == BASE 捕获失败集**精确相等**（python 集合比对 `basenames == ledset` → True）；`knownRed=4 + environmentRed=28` 无捕获外条目；对齐环境复跑 4 失败 == knownRed 精确相等（28 例转绿实证） | ✔ |
| **B-3b** 名级谓词 + 提取负控 | runner `runRootTestCell`：`failedUnexpected = failedTestNames − (knownRed ∪ environmentRed)`（完整名集合级，`run-baseline.mjs:904–906`）；捕获 JSON 中 4 例 test-d 失败名**实际在场**（`issue421` 文件过滤计数 = 4，含类型面断言名） | ✔ |
| **B-3c** 新文件永不可入账 | BASE 捕获 0 条来自本票文件（结构上：捕获于干净 BASE worktree）；当前矩阵 run `failedTestNames == 台账集合` 精确相等 ⇒ 本票新文件 0 失败 0 入账 | ✔ |
| **B-3d** 披露绑定 | `root-test.json`：`status=pass`、**`failedUnexpected=[]`**、`disclosure` 五键在场，`statement` 含「never licenses a claim that root-test/CI/all existing tests are green」表述禁令；SA3 §8-2 摘要逐条列在账红（4 test-d + 28 环境红）+ 对齐复跑证据 | ✔ |
| **B-3e** 聚合语义 | `matrix.json` 41 cell 全 pass、`MATRIX PASS: 41 cells`；红 ⇒ exit≠0 语义未触（`--fault` 编排在 N-1/N-2 证 exit≠0 于内层 fail；gates 于 N-6 证 exit 1） | ✔ |

台账文件本体（76 行）：逐条 attribution（4 knownRed → #470 I-5.2/I-7 归因；28 environmentRed → pnpm 10.28.2/11.28.5 未对齐）+ notes 载明 B-3a/b/c/d 纪律与禁令。**台账未被实现/验证期增项**（集合 == Step 0 捕获）。

### 项 5 — T-4 与负控/变异：**clear（附 1 条证据新鲜度观察）**

- **N-1**（`B3/fault-substitute-npm.json`）：`cells[]` = provenance **fail** + root-probe **fail** + ws-cordis-channel **fail**（3/3 逐 suite，§12.8-3 收口口径满足；外层 exit 0 仅编排事实）✔
- **N-2**（`B3/fault-legacy-shim.json`）：`cells[]` = root-probe **fail** + ws-cordis-channel **fail**（2/2；E4a 贯通后通道测试 fault 消费成立——channel 文件按 F9 纪律读 `NOMICORE_CORDIS_FAULT` 对同一受控 ctx 注入，`C.absent.*` 双缺席断言定向红）✔ 无单 suite 红冒充。
- **N-3/M-1**（三基线各一轮）：channel 恰 3 红 = `C.legacy-only.{hub-listen,peer-dial,session-host}`；同变异 ws-package 66/66 仍绿（缺口证明）✔
- **N-3/M-2**（三基线各一轮）：channel 9 红 = `C.both.priority.*`(3) + `C.malformed.*`(3) + `C.symbol-only.*`(3)（第三组为同因 legacy-getter 计数断言的加强灵敏度，超出设计点名组为**更红**方向，不构成偏差）；ws-package 66/66 ✔
- **还原**：6 组 `sameAsPristine=true ∧ sameAsHead=true`（bytes=39033 与 `git show HEAD:plugin.ts` 双向逐字节一致）✔
- **N-6**（`negative/N6-gates.log`）：G10 `cat_6=3` 恰三注入形态（M1/M3/M1 可选链，零标记样本）+ G11 FAIL（internal/update）+ gates exit 1；注入件已删（`ls` 不存在，`packages/persistence/src` 恢复零 diff）✔
- **观察项（非阻断）**：N-6 log（03:22:41）早于 gates.mjs 终版（03:49:33）27 分钟，log 内 G8 文案为 D-3 修正前形态；但 G10/G11 的可观察行为在两版间**逐类全等**（N-6 非注入计数 {20,13,9,4,196,46} 与终版 {…,197,46} 的唯一差 = D-2 后 timers:212 行，且该行为 5D 排除类）——定向红结论对终版 gates 成立。建议随项 2 修复一并对终版 gates 重取 N-6 留证（一并消除该观察项）。

### 项 6 — D-2 / D-3 偏差裁决（本轮明确出裁）

**D-2：clear —— 已回到设计原文口径，判据不变；iter-0 偏差收敛成立，RATIFY。**
- 设计 §9.1 bulk-transfer ACK 行原文即「hub/peer namespace（**kind=2 自持 ACK**，arm 点 `hub-namespace.ts:1050` `armTimer('assembly')`）| `ackTimeoutMs`/`assemblyTimeoutMs` | ACK 发出/装配超时」。iter-0 的 kind=0 手工注入是对该行的偏离；本轮 `T.chunked-bulk-ack` / `T.assembly-timeout`（`ws-replication-cordis-root-timers.test.ts:700–779`）以**生产触发链**驱动：peer 100 KB 写（> `maxChunkedUpdateBytes` 64 KiB ⇒ live 不可分块）→ 恢复 round diff > `maxSyncDiffBytes` 32 KiB → kind=2 chunked SYNC_STEP2，并**从 wire 字节解码断言 ≥2 帧 `UPDATE_CHUNK transferKind===2`**（真实 kind=2 的硬证据，非注释性主张）；arm 判据 `meter.includes(assemblyTimeoutMs)`（delay===配置值，66/40 两档）；触发后果 `-aborted` 且 `reason==='timeout'`；取消两路径（连接 close / aborted 后 `pendingFor===0`）。三段判据（arm→触发→取消）与设计 §9.1 表后段逐字对齐。尾帧 withhold 在**测试侧 transport seam**（`wrapHubEnd` 包装，`:100–110` 注释明示「never a production path」+ 弃用丢帧的理由：连接级序号缺口）——零生产改动。**判据未变、载体从合成注入升为生产链路，属加强。**

**D-3：clear —— 2 行钉定允许清单是「生产 src 无 env/通道分支」唯一可满足的机械形态，RATIFY 并发布为钉死值（R-2）；无需回设计、无需 ADR、无需改生产配置读取。**
- 事实基础（本会话第一手）：全 src 树 `process.env` **恰 2 行** = `apps/yjs-server/src/main.ts:36,37`（`NOMICORE_CONFIG`，应用自配通道，BASE 既有）；通道标记（`CORDIS_BASELINE|ROOT_CHANNEL|NOMICORE_CORDIS_|rc.12`）全 src 零命中。
- 形态裁定：设计 G8 语义 = 扫描面扩至 apps/domains src + 「无 env/通道分支」；BASE 自带这 2 行合法应用配置 ⇒ 字面「零 process.env」在零生产 diff 约束（§5 + DENY `apps/*/src`）下**不可满足**；整树豁免（iter-0 形态）已被正确放弃。逐行钉死（file:line 级、漂移即红、该 2 行上通道标记仍禁）是唯一同时满足「扫描面全量」「fail-closed」「零生产 diff」的机械形，且严格强于 BASE G8（3 包 src → 全 src + 新增 `NOMICORE_CORDIS_` 模式）。
- 规范面：G8 为票级设施语义（#470 建立、本票设计扩展），不触 ADR 0035 §4「依赖/公共契约不变」（该 2 行为 BASE 冻结行为，本票零改动）——**无 ADR 义务**。
- **R-2（新钉死值，自本章起）**：`G8_ENV_LINE_ALLOW = {apps/yjs-server/src/main.ts:36, :37}`（`gates.mjs:55–58`）；增删（含改行内容、行号漂移）即回 SA8；通道标记永不豁免。SA3 的「明确问句」据此答复：**可接受，按上述钉死值执行；不要求另立 ADR、不要求改 app 配置读取方式**。

### 项 7 — §9.3 十二条交付条件逐条裁决

| # | 条件 | 裁决 | 证据位置 |
|---|---|---|---|
| 1 | 零生产 diff + diff ⊆ 十文件 | **pass** | 项 1；`git diff --name-only d59a4d1 -- 'packages/*/src' 'apps/*/src' 'domains/*/src'` = 0 行 |
| 2 | gates 12/12 PASS（G10 类6空+自校验、G11 零命中、G12 精确） | **pass-with-exception**：实跑 12/12（`gates.log:298–310`）成立，但 G10 实现对钉死语义缺 M4 跨行 fail-closed（项 2a）——**按项 8-1 修复后重跑方为最终 pass** | `gates/gates.log` |
| 3 | 三基线 typecheck 3×15/15 逐 project | **pass** | `B{1,2,3}/B*-typecheck.json`（15 project exitCode 全 0，本会话逐基线复算）+ 45 份日志 |
| 4 | 矩阵 41 行全 pass + units 23/23×3 + 并集 69 + timers 12 族 | **pass** | `matrix.json` 41/41 pass（12 suite×3 + typecheck×3 + gates + root-test）；三基线 `units={expected:23,observed:23,missing:[]}`、`coverage=true`、`foreignUnits=[]`、`issue420={present:true,tests:10}`；**69 并集本会话从三 cell testNames 独立复算 = 恰 69（coverage 0 计入）**；timers 12/12×3 |
| 5 | A1 断言三基线全绿 + 稳定文案逐字体 | **pass** | channel 29/29×3；`ROOT_TIMER_MESSAGE`/`TIMER_SERVICE_MESSAGE` 双冻结文案常量钉死（channel `:54–55`） |
| 6 | N-1…N-6 应红实红 + M-1/M-2 三基线各一轮 + 逐字节还原 | **pass** | 项 5；`mutations.json` restores 6×双 true |
| 7 | 4 具名 fixture 逐字节不动 + ws-package 三基线 66/66 | **pass** | 项 1（零 diff）+ `B*/ws-package.json` 66/66×3 |
| 8 | S4 台账合规（B-3a…e 全项） | **pass** | 项 4 |
| 9 | 新测试默认布局必绿（D-7/B-3c） | **pass** | 矩阵 root-test failedTestNames == 台账集合（本票新文件 0 红）+ SA3 §6 V-8 默认布局聚焦日志 |
| 10 | 反向闸门执行记录（生产行为红 ⇒ 停 cell 留证上报，不修 src） | **pass（未触发）** | 本轮全部红 cell 均归因实现/设施缺陷并修于 ALLOW 文件内（SA3 §6.1 三类），生产 src 零 diff 佐证未发生就地修 |
| 11 | AC9 全机械面（依赖/manifests/lock/artifacts/docs 零 diff；无 volatile/internal；命令白名单；无部署/patch） | **pass** | G1′/G7/G9/G11/G12 PASS；`git status` 无其他改动 |
| 12 | 交付摘要按 §13.2 闭合 + A8-4 披露 + §16.3 影响矩阵 | **pass（SA3 侧）/ 待交付包装** | SA3 §8-2 已载 A8-4 披露与表述禁令；§16.3 矩阵因零生产 diff 为「零变化」——**最终 PR 交付摘要须逐条带入披露与影响矩阵**（Controller/SA10 包装义务，非 SA3 缺陷） |

---

## 3. Decision analysis（汇总）

| 决策/约束（钉死值） | 条款 | 实现行为 | 分类 | 证据 | Required action |
|---|---|---|---|---|---|
| iter-0 §9.1 十文件闭合 ALLOW | 闭合世界 | 并集恰十文件；#470 面零回改 | implements-existing-decision | 项 1 | 无 |
| iter-0 T-2 / iter-3 §14.5 | G10/G11 清单钉死 | LINE 5 + FILE 2 + 空集，零增删 | implements-existing-decision | 项 3 | 无 |
| iter-3 I-1@rev2.1 | BASE 首跑对账 | BASE 子集 285 条多重集全等；delta 4 条全解释 | implements-existing-decision（+ R-1 读法追认） | 项 3 | 无 |
| iter-3 §14.8-2 I-1③ | M4 跨行实参位 fail-closed | **未实现**（照抄脚本局限，静默丢弃） | **（对钉死值的未申报偏离，可修正）** | `gates.mjs:430–441,547–560` vs 设计 L281 | **§5-1（reject 点）** |
| §9.2 rev 2.1 V_ctx 词表 | 「以 ctx/Ctx 结尾」大小写敏感 | 后缀正则加 `[a-z0-9_]` 前置类（`ACtx`/`$ctx` 收窄） | （同向微偏离，零实存） | `gates.mjs:363–364` | §5-1b |
| §9.2 回归自检表（I-3） | 16 行钉死 | gate 侧 12 行 + 15 探针（缺 4 排除类行） | （不完整；BASE 反向兜底成立） | `G10_SAMPLES` | §5-1c |
| iter-0 T-1a 四款 | 23 名枚举/coverage/fail-closed/69 | 逐款兑现；69 经独立复算 | implements-existing-decision | 项 2b/项 7#4 | 无 |
| 设计 §8.1/E5 全名分隔符 | `' > '` 假设 | 改 `assertion.title`（Host 强制，事实纠偏） | （钉死谓词可满足性修正——RATIFY） | `run-baseline.mjs:594–617` | 无（追认） |
| SA6 §12.6/B-4 A6-4 | interop/418 三基线在场且绿 | 文件级在场+自身全绿（Host 强制，中文名事实） | implements-existing-decision（+ 机械形追认） | `run-baseline.mjs:774–791`；a64 三 true×3 | 无（追认） |
| iter-0 B-3a…e（T-3） | 台账五绑定 | 逐条成立（含 == 精确相等复算） | implements-existing-decision | 项 4 | 无 |
| iter-0 T-4 / 设计 §11 | N-1…N-6/M-1/M-2 | 全部应红实红 + 逐字节还原 | implements-existing-decision | 项 5 | N-6 终版重取（随 §5-1） |
| 设计 §9.1 bulk 行 | kind=2 自持 ACK @ armTimer('assembly') | 真实 kind=2（wire 解码）+ 判据三段不变 | implements-existing-decision（D-2 收敛 RATIFY） | 项 6-D2 | 无 |
| 设计 §7.3 G8 | 扫描面扩展 + 无 env/通道分支 | 四 src 全扫 + 2 行钉定 | implements-existing-decision（+ R-2 钉死值发布） | 项 6-D3 | 无 |

## 4. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

无 override 诉求：全部裁决在规范集合与既有钉死值内自解；D-3 的 2 行钉定为既有 G8 语义的可满足机械形（R-2），非旧决策覆盖。

## 5. Frozen surfaces（实现态核对）

iter-0 §6 全表逐项：wire/协议零改动（`replication-protocol/**` 零 diff）；公共导出面零 diff（G4 PASS + `src/index.ts` 零 diff）；G5 快照内容不变（`public-surface.base.json` 零 diff + G5 PASS——B-5 闭合）；服务名/持久化布局/装配拆卸序（断言承载，三基线绿）；稳定错误文案双常量钉死；#470 已交付面零回改（项 1）；设施冻结子面 4 件零 diff（G12）；manifests/lock/artifacts/docs/tsconfig/vitest.config 零 diff（G1′/G6/G7/G9）；`baselines.json` integrity/dshCommit/probes 期望值零变化（转义噪音除外，JSON 语义相等）。**本轮新增钉死值**：R-1（I-1@rev2.1 对账读法）、R-2（G8_ENV_LINE_ALLOW 恰 2 行）。

## 6. Evolution requirements

无——未触碰任何 ADR/CONTEXT/协议文本；D-3 裁定明确无 ADR 义务。

## 7. Hard conflicts

无 ADR/协议级 hard-conflict。**唯一阻断项为对 SA8 钉死值（I-1③）的可修正实现偏离**（§2 项 2a），落在 ALLOW 文件内、修复可满足且不影响任何对账基线。

## 8. Required actions（交最终评审前必须闭合的硬约束）

1. **[阻断] gates.mjs G10 三点对齐钉死文（单文件修复，无需 ALLOW 增删、无需设计修订）**：
   - (a) **M4 跨行实参位 fail-closed**：行内无 `(` 但呈「行首实参续行形」（`'root'` 为首个非空白 token 且后随 `,`/`)` 类）的字面量不得静默丢弃——记 `callee=UNRESOLVED-CROSSLINE` ⇒ 类 6（或实现跨行归属）；case 标签/类型联合等非实参位维持非候选（与对账基线兼容——全树零实存已证，修复后 BASE 子集计数必须仍为 285/19/13/7/4/196/46/0）。
   - (b) `inVctx` 后缀判定对齐钉死文：token 以 `ctx`/`Ctx` 结尾即入表（去掉 `[a-z0-9_]` 前置字符类），大小写敏感不变。
   - (c) `G10_SAMPLES` 补齐设计 §9.2 表缺行：`service.ts:46`（类 3）、`issue301:624`（类 2）、`app.ts:880`（5D-R receiver=args）、`[...root.keys()]` 非候选探针。
   - 修复后：`node …/gates.mjs` 重跑须 12/12 PASS 且计数不变（delta 仍恰项 3 的 4 条新文件命中）；**同 pass 重取 N-6 留证**（消除项 5 观察项）；SA3 报告 §3/§5 的「以 §9.2 文本语义落地」表述据实更正（M4 跨行从缺位到落地）。
2. **[包装义务，非 SA3 缺陷]** 最终交付摘要逐条带入：A8-4 披露（4 test-d + 28 环境红 + 表述禁令 + 对齐复跑证据）、§16.3 调用方影响矩阵核对（零生产 diff ⇒ 零变化）、S4 所选语义显式声明（台账判定制）——§9.3-12 的收口载体。
3. **[路由前提]** `wiki/raw/task_issue-471_sa4_review.md` 当前缺位——最终评审（SA9/SA10）派发前须由 SA4 出具同组评审（或 Controller 记录其缺席裁定）；本报告结论不依赖该文件。
4. 其余追认事项（R-1/R-2、D-2 收敛、两处 Host 强制机械形、baselines.json 转义噪音、E1「6 文件」笔误以 §7.4 为准）**不要求动作**；设计文本如后续再版可顺带勘误，非本轮义务。

## 9. Verdict（implementation）

**reject（外科手术式，单点可修正）** —— 七项逐裁：项 1（ALLOW 守界）**clear**；项 3（T-2 零增删 + I-1@rev2.1 对账，delta 逐条成立）**clear**；项 4（T-3/B-3a…e）**clear**；项 5（T-4 负控/变异）**clear**（附 N-6 重取要求）；项 6 **D-2 clear / D-3 clear（R-2 发布）**；项 7（§9.3 十二条）11 条 pass + 条件 2 pass-with-exception；项 2 **一处 reject**：gates.mjs G10 未实现钉死的 M4 跨行实参位 fail-closed（I-1③/设计 L281 明文「不得静默按非候选丢弃」），系对 SA8 钉死值的**未申报强度削减**，且与 SA3 报告「以 §9.2 文本语义落地」的自述不符；另含两处同文件字面偏差（inVctx 后缀边界、自检表 4 行缺）。实现骨架（十文件守界、零生产 diff、台账、负控、矩阵、units/69、D-2/D-3 收敛）**全部守住**；阻断面收敛于 gates.mjs 单文件的三点对齐，修复后按 §8-1 重跑 gates + N-6 即闭合，**无需回 SA1、无需 owner、无需 ALLOW/设计变更**。闭合前不得交 SA9/SA10 最终评审。

## 10. requiresConflictRecheck

**true** —— (i) §8-1 修复落地后须复核：gates 重跑 12/12 + BASE 子集对账不变（285/19/13/7/4/196/46/0）+ 跨行 fail-closed 定向红（可加一条续行形注入到 N-6 三形态旁证）+ N-6 终版留证；(ii) 最终交付摘要的 A8-4/§16.3/S4 包装义务（§8-2）核对；(iii) SA4 同组评审出具后如有新决策面回 SA8；(iv) 其余面（D-2/D-3/R-1/R-2）本轮已闭合，无悬置核对项。

---
---

# iteration 2 — 实现级冲突复查（增量：SA3 iteration 2 修复闭合核验）

1. **Reviewed subject**: implementation（iteration 2 增量 = SA3 对上轮 §8-1 三点阻断的修复：`gates.mjs` G10 四点 + `baselines.json` 最小 diff 还原；声称其余 8 文件零改动）。SA8 dispatch：`sa-d614d29b-2d4e-4e4e-ad1e-b57f9620803f`，iteration 1，phase conflict-gate。本会话只读裁决（唯一写入 = 本章节与 `/tmp` 对账脚本；按 dispatch 授权**只读复跑了 `gates.mjs` 一轮**，未运行 vitest/tsc 套件、未修改任何被审对象）。
2. **裁决基准**：本报告 iter-1 全文（§9.1 十文件、T-2/T-3/T-4、B-1…B-5、R-1/R-2、I-1@rev2.1 对账基线 `1=19 2=13 3=7 5=4 5D-R=196 5D-C=46 6=0`/285 条、§8-1 修复要求）+ 设计 §9.2 rev 2.1 钉死文（R1 M4 跨行句 L281、R2 表序 L288、自检表 L307–323）+ ADR/CONTEXT（iter-1 §4 同集，本轮零触碰 `docs/**`——本人复跑 G7 PASS 佐证）。同组输入：`wiki/raw/task_issue-471_sa4_review.md`（**已在场**，04:19:21——iter-1 §8-3 路由前提解除；其 MAJOR SA4-1 与我 §8-1 同根）+ SA3 §9（`task_issue-471_sa3_impl.md:147–263`）。

## 11. Inputs and decision set（本轮实读/实跑）

| 输入 | 核对方式 |
|---|---|
| `gates.mjs`（821→1001 行；对 BASE `+606/−28`） | 全文实读（G10 块 `:347–801`、钉死常量 `:41–82`、G8 `:917–940`、G11/G12 `:803–850`、runner `:956–1001`）+ 对 BASE 逐 hunk 定位（7 hunk 全落授权面） |
| `baselines.json` diff | 全量 diff 实读（单 hunk `@@ -1,16 +1,22`、`+9/−3`，三处语义编辑） |
| **本人第一手复跑** | `node …/gates.mjs` → **12/12 PASS、exit 0**（`/tmp/sa8-iter2-gates-rerun.log`）；G10 `categories={"1":20,"2":13,"3":9,"5":4,"6":0,"5D-R":197,"5D-C":46}`、289 条全量记录、`scanned=738`、samples 16/16、cast 18/18、cross-line 8/8、seam 2/2 |
| **独立多重集对账** | python 分桶（`git ls-tree -r d59a4d1`）+ 与 `.cache/issue471-g10-dryrun/report-main.txt` 285 条双向差集（键 = 类,位置,形态+token） |
| 修复前后逐字节主张 | `diff` 归档 `evidence/gates/gates-prefix.log`（iter-1 终态）vs `gates-final.log` 的 289 条记录段 = **空**；本人复跑记录段 vs `gates-final.log` = **空** |
| 负控/变异证据（5 件） | `negative/{N6-gates-final,N6-crossline-gates,N6-crossline-blank-gates,M3-no-crossline-probe,M4-old-vctx-probe}.log` 逐件实读（类 6 注入记录 + failed gate 清单） |
| 矩阵/units 证据 | `matrix/matrix.json`（41 cells 全 pass，`generatedAt=2026-11-14T20:41:11Z` = 修复后重跑）、`unit-union.json`（23×3=69）、lifecycle cell `units={23,23,[]}`+`coverage=true`+`foreignUnits=[]`+`issue420={present,10}`、root-test cell `failedUnexpected=[]`+disclosure 五键、typecheck 3 pass、gates cell pass exit0 |
| iteration-1 证据有效性 | `.cache/mutations/mutations.json`（三基线 M-1 恰 3 红 / M-2 恰 9 红、`restores` 6×`sameAsPristine∧sameAsHead`（bytes=39033））、`B3/fault-{substitute-npm,legacy-shim}.json`（N-1 cells 3/3 fail、N-2 cells 2/2 fail） |
| 守界/时间线 | `git status --porcelain`（恰 3M+7?? 非wiki = 十文件）、三 src 树 pathspec diff = 0 行、#470 面 9 文件逐件 0 行 diff、十文件 mtime 全表 |

## 12. Decision analysis（dispatch 六项逐裁）

### 项 1 — 上轮阻断点闭合：**clear（三点全部闭合，第一手验证）**

- **(a) M4 跨行实参归属 + fail-closed**：`m4ContextsOf`（`gates.mjs:463–535`）整文件词法器（字符串/块注释状态 + 括号栈、分组括号透明、被调点链从全文回溯跨行透明）为每个真实 `'root'` 字面量记录最内层 call-like 括号与「实参首 token」判据（前一非空白字符 ∈ {`(`,`,`}，`:493`）；`m4CandidateOf`（`:541–548`）先跑已追认的同被调行判据（`:434–445`），其 null 后**不再 continue 静默丢弃**——`callLike ∧ argumentStart` ⇒ 按归属被调落 V_M4 ⇒ 类 6 / 否则 5D-C 记录；**被调点链空白 ⇒ `callee=UNRESOLVED-CROSSLINE`（`:460`）⇒ 候选 ⇒ 类 6**（sweep `:624`）。非实参位（case 标签/类型联合/模板串/数组对象元素/箭头体/定义位键形）维持非候选——与 R1 M4「**独立的** `'root'` 字面量出现在调用实参位」钉死定义一致（非首 token 实参如 `prefix + 'root'` 非独立字面量，同被调行判据对同款单行形态反而更激进地记 5D-C，无净削弱方向）。实证：`N6-crossline-gates.log` 注入 `Reflect.get(\n ctx,\n 'root',\n)` ⇒ `cat_6=1 [M4 (callee=Reflect.get)]`，其余 11 gate 绿、1/12 failed；`N6-crossline-blank-gates.log` 注入 `(channel)\n('root')` ⇒ `cat_6=1 [M4 (callee=UNRESOLVED-CROSSLINE)]`——两条均为**定向红**（注入位于 `packages/persistence/test/n6-crossline-injection.ts`，在 G2/G3/G12 pathspec 外，不引入其他 gate 噪声）。I-1③「不得静默按非候选丢弃」已落地。
- **(b) inVctx 后缀边界**：`gates.mjs:366–368` = `token === 'ctx' || 'context' || 'host' || token.endsWith('ctx') || token.endsWith('Ctx')`——回到钉死词表原文「以 `ctx`/`Ctx` 结尾」且大小写敏感，前置字符类已删除；`ACtx`/`$ctx` 探针 ⇒ 类 6（`:719–720`），对照 `fiberCtx`/`timerCtx` ⇒ 6、`fiberCTX` ⇒ 5D-R（`:716–718`）。**M-4 变异**（回退旧正则，`.cache/m4-alignment/gates-old-vctx.mjs`）下两探针即红（`M4-old-vctx-probe.log`：`got 5D-R`）——探针真测该边界。
- **(c) 自检表 12→16 行且绑类+token**（`G10_SAMPLES` `:640–657`）：4 条缺行全部补齐并逐行绑「类 + 判别 token」——`service.ts:46`⇒3/`string interior`（`:652`）、`issue301:624`⇒2/`root(`（`:653`）、`app.ts:880`⇒5D-R/`receiver=args`（`:646`）、`materialize-root.test.ts:782`⇒**none**（`:654`，`gateG10` `:756–759` 以「不得出现在任何命中类」负向断言承载——定义/枚举位不能以静默丢弃形态存在）。与设计 §9.2 自检表 16 行期望逐行一致；本人复跑 16/16 通过。
- **iter-1 §8-1 尾项「N-6 以终版 gates 重取」**：`N6-gates-final.log`（04:29:54，终版 gates）`cat_6=3` 恰三形态钉死样本（`n6-g10-injection.ts:2–4` M1/M3/M1 可选链，零 Cordis 标记）、非注入计数 `{20,13,9,4,197,46}` 与终版一致（含 5D-R=197——iter-1「证据新鲜度」观察项消除）、G2/G10/G11 三红 3/12 failed。旧 `N6-gates.log`（03:22:41）已由终版重取取代。

### 项 2 — 修复是否越权：**clear（全部落在授权语义内，无门禁强度削减）**

- **gates.mjs 对 BASE 的 7 个 hunk 全落授权面**：`@@-38`（BASE 钉）、`@@-47`（G3/G12/G11/G8 常量组）、`@@-319,6+343,512`（G10 全块 +512 行——本轮增量所在）、`@@-342,34+872,77`（G11/G12/`listSrcRoots`）、`@@-377,7+950,7`（G8 = R-2 两行钉定）、`@@-388/@@-407`（runner 挂载）。**G1′/G2–G7/G9 判定函数与扫描逻辑零触碰**（BASE 行 111–318 区间无 hunk）。
- **钉死常量零增删**（本会话逐行核对）：`G10_LINE_ALLOW` 恰 5（`:349–355`）、`G10_FILE_ALLOW` 恰 2（`:356–359`）、`FORBIDDEN_API_ALLOW=[]`（`:67`）、`FACILITY_ALLOW` 恰 4（`:60–65`）、`WS_ALLOW_NEW_FILES` 恰 4（`:52–57`）、`G8_ENV_LINE_ALLOW` 恰 2 行（`:79–82`，R-2）、`V_M4` 恰 {`Reflect.get`,`safeReadChannel`}（`:370`）、R0 扫描面 + 设施目录排除原样（`:555–558`,`:888–901`）、N-6 三形态钉死内容原样（终版重取日志逐字命中）、seam 自校验 2/2（`:752–754`）、类 6 唯一红类 + 全量命中清单输出（`:783–792`）。
- **新增代码均为加强方向**：`m4ContextsOf`/`m4CandidateOf`/8 条跨行探针（`:737–746`）/V_ctx 边界探针只**扩大**候选覆盖（跨行实参位从不可见 ⇒ 归属或 fail-closed），无任何既有判定谓词被收窄；`classifySampleText`/`classifyM4SampleText`（`:659–706`）复用 sweep 同一判据，探针与实扫不形成两套语义。
- **SA4-2 分类表序对齐（唯一谓词序改动）——裁为无冲突**：sweep 现按钉死表序 1→2→3→4→5→5D→6 首中即定，其中行 2/3 限定**代码位**（`:586–596`）。该限定是钉死文的唯一自洽读法：① JS 文法上注释散文既非字符串字面量也非调用（「字符串字面量内部」「同名 helper 调用」按文法只能落在代码位）；② 行 2 与行 3 判据在 `inStringLiteral` 上互斥、行 5 前置不变 ⇒ 该重排对任意输入**行为恒等**（iter-1 顺序 1→5→3→2→5D→6 下注释优先、代码位 3 先于 2；重排 + 代码位限定后各输入落类逐一相同）；③ 若按无限制字面序执行，rev 2.1 已追认的两行 `*` 引导 JSDoc（`service.ts:41`/`plugin.ts:210` ⇒ 类 5）将迁 3，与 I-1@rev2.1 钉死基线（`3=7/5=4`）矛盾——即字面序才是偏离。行为恒等由**逐字节证据**双保险：归档修复前后 289 条记录 `diff` 为空 + 本人复跑与钉死基线多重集全等。SA3 §9.2(e) 已明示取舍依据，无未申报偏离。
- **baselines.json 最小 diff**：单 hunk `+9/−3`，恰三处语义编辑——`base` 重钉 `279dba4→d59a4d141…`、`comment` 追加 #471 句、`suites` 尾部 +6（原 6 项顺序不动）；**hunk 之外与 BASE 逐字节相同** ⇒ `dshCommit`/`baselines`/integrity/probes 期望值零变化、无夹带。E1 注册语义与 `base` 重钉语义均保持：矩阵 41/41 为 baselines.json 重写后（04:30）的重跑（04:41:11Z）所复证——manifest 仍驱动 runner。iter-1 转义噪音观察项（SA4-5）随之消除。（记录一处笔误：SA3 §9.2(g) 称「diff 恰 3 hunk」，实为**1 个 hunk 内 3 处语义编辑**；`+9/−3` 与语义内容无误。）

### 项 3 — 计数零漂移主张：**clear（第一手复算完全成立）**

- **本人复跑**：12/12 PASS、exit 0、`categories={"1":20,"2":13,"3":9,"5":4,"6":0,"5D-R":197,"5D-C":46}`、289 条记录——与 SA3 §9.3 主张及 iter-1 终态**逐字节相同**（归档 `gates-prefix.log` vs `gates-final.log` 记录段 `diff` 为空；本人复跑 vs `gates-final.log` 记录段 `diff` 为空）。
- **独立分桶复算**（本会话 python，按 `git ls-tree -r --name-only d59a4d1`）：BASE 子集**恰 285 条** = `1=19 2=13 3=7 5=4 5D-R=196 5D-C=46 6=0`——与 I-1@rev2.1 逐项相等；与干跑基线 `report-main.txt` 285 条做（类,位置,形态+token）**多重集双向差集 = 0**（无类漂移、无 token 漂移、无 `undefined` 残留）。
- **新增文件命中恰 4 条** `{1:1, 3:2, 5D-R:1}`：`ws-replication-cordis-root-channel.test.ts:453 [M4 (allowlist callee=Reflect.get)]`（类 1 = 文件级许可行的记录，非新增许可）、`third-party-timer-ownership-red.test.ts:87`（类 3）、`cordis-baseline-support.ts:44`（类 3）、`ws-replication-cordis-root-timers.test.ts:212 [M1 (receiver=options)]`（5D-R）。**5D-R 197 相对 196 的 +1 确证** = 该 timers:212 域键载荷行（`root: options.root ?? …`），属 5D 排除类逐条记录，非红类——与 iter-1 项 3 裁定一致，非新漂移。

### 项 4 — 自证伪与 M-3：**clear**

- 跨行实参注入与跨行空链注入两条均应红实红（项 1(a)，`cat_6=1` 定向红、其余 gate 绿）。
- **M-3 变异**（把跨行判据回退为静默丢弃，`.cache/m4-alignment/gates-no-crossline.mjs`，gitignored）：`M3-no-crossline-probe.log` 中 5 条跨行候选探针全部 FAIL（`got (no candidate)`）——修复真的被封在该变异下，探针非摆设；3 条非候选探针仍绿（未过度泛化）。
- **M-4 变异**（inVctx 回退旧正则）：`ACtx`/`$ctx` 两探针 FAIL（`got 5D-R`）。
- **零残留**：`packages|apps|domains` 全树无 `n6-*`/injection 文件（本会话 find 空）；`git status --porcelain` 非 wiki 改动恰十文件；三 src 树对 BASE 零 diff。变异件 `gates-no-crossline.mjs`/`gates-old-vctx.mjs` 仅存 `.cache/m4-alignment/`（`git check-ignore` 确认）。

### 项 5 — 守界与不得回退：**clear**

- **实际改动仍恰 §9.1 十文件**：3 M（baselines.json/gates.mjs/run-baseline.mjs）+ 7 ??（4 ws 测试+support、ownership、dsh-profile、台账）；无第 11 文件。
- **「其余 8 文件零改动」成立（时间线 + 复核双证）**：十文件 mtime 全表中，仅 `gates.mjs`（04:34:09）与 `baselines.json`（04:30:23）晚于两份 iter-1 评审（SA4 04:19:21 / SA8 04:22:10）；其余 8 文件 mtime ≤ 03:51:31——即两份 iter-1 评审所核验的同一批字节。`run-baseline.mjs` 对 BASE `+217/−21`、1066 行 = iter-1 实测值；E1–E7/E4a 钉死值抽查在位（`LIFECYCLE_UNITS` 3×7 笛卡尔 + 2 补充 = 23 名 `:103–110`、`faultEnv`→4 个 `runVitest` 调用点 `:586/:623/:649/:711/:751/:795`、E3 `'gates'` 死字面量清除后仅余 cell 实装 `:846/:852/:1009`）；SA4-3 点名的两处测试侧装饰性断言原样保留（lifecycle `:584`、timers `:493`——SA3 §9.2(h)/§9.7-1 已披露为窄面守界不动的待追认清理项，恒真断言不触任何判定谓词，SA4 自评 MINOR——**裁为可接受**）。
- **#470 面零回改**：`plugin.ts`/`service.ts`/4 具名 fixture/4 冻结设施件（含 `public-surface.base.json`、`root-probe.mjs`）/guard-proxy 逐件 0 行 diff（本会话逐文件复跑）；三 src 树 pathspec diff = **0 行**。
- **T-2/G11/G12/G8 白名单零增删**（项 2 逐行核对）；G12 实跑 PASS（本人复跑）。
- **矩阵/units/负控证据有效**：`matrix.json` 41 cells 全 pass（修复后 04:41:11Z 重跑）、`unit-union` 23×3=69、三基线 lifecycle `units={23,23,[]}`+`coverage=true`+`foreignUnits=[]`+`issue420={present,tests:10}`（cell 字段直读）、typecheck 3 pass、root-test `failedUnexpected=[]`+disclosure 五键、gates cell pass exit0；iteration-1 的 N-1（3/3）/N-2（2/2）/M-1/M-2（3 基线 3/9 红 + 6 次还原双 true）证据在盘且其对象（生产 src、测试文件、runner）经时间线与零 diff 证明未变——证据继续有效。

### 项 6 — 结论

**verdict = clear**。上轮唯一阻断（§8-1 三点）全部闭合且经第一手复跑/注入/变异三向验证；修复无越权（表序对齐裁为钉死文的唯一自洽读法且行为恒等有逐字节证据）；计数零漂移主张逐项成立（含 5D-R +1 的归属确认）；守界面完整。**可交 SA9/SA10 最终评审**。

## 13. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|

无——表序「代码位」限定为钉死文的文法自洽读法（非覆盖）；M-3/M-4 变异件与注入样本均为 `.cache` 一次性验证工件，不构成决策面。

## 14. Frozen surfaces（iter-2 增量核对）

iter-1 §5 全表维持（wire/公共导出/快照/文案/持久化/manifests/lock/artifacts/docs/tsconfig/vitest.config 零 diff，本会话以 12/12 复跑复证）；**本轮新增确认**：T-2 五行两文件清单、G11 空集、G12 四文件、R-2 两行、V_M4 双成员、N-6 三形态钉死内容、R0 扫描面、`baselines.json` integrity/dshCommit/probes、E1–E7/E4a runner 编辑点、T-1a 计账——全部零漂移。

## 15. Evolution requirements

无——零 ADR/CONTEXT/协议触碰（G7 PASS）。

## 16. Hard conflicts

无。iter-1 的唯一阻断项已闭合；本轮无新决策面、无未申报偏离。

## 17. Required actions（非阻断，随最终交付处理）

1. **[包装义务，沿 iter-1 §8-2，非 SA3 缺陷]** 最终 PR 交付摘要逐条带入：A8-4 披露（4 test-d + 28 环境红 + 表述禁令）、§16.3 调用方影响矩阵（SA3 §9.6 已有成段核对可径引）、S4 台账判定制声明。
2. **[待追认清理项，非阻断]** SA4-3 两处测试侧装饰性断言（lifecycle `:584`、timers `:493`）——如要求清理，任一后续窄面删除并复跑对应 cell 即可；本轮窄面守界（「只涉及 gates.mjs」）理由成立。
3. **[记录性勘误]** SA3 §9.2(g)「diff 恰 3 hunk」实为 1 hunk 3 处语义编辑（`+9/−3` 无误）；如报告再版可顺带更正。
4. **[边界观察，非阻断]** `m4ContextsOf` 不建模正则字面量（与被追认的干跑脚本同族局限）：极端构造下（同行正则含引号致括号栈错位 + 跨行 V_M4 实参）字面量可被误归属到错误被调而落 **5D-C 记录**（仍是逐条记录、gates.log 可审计，非静默、非直接免红）；行首引号态逐行重置 + 同被调行判据兜底使常规形态不可达。钉死文未要求完整 JS 解析器，维持观察项，不构成修复义务；若未来命中记录出现非常规被调名可循 5D-C 审计通道追溯。

## 18. Verdict（iteration 2）

**clear** —— dispatch 六项逐裁：项 1（阻断闭合）clear；项 2（无越权）clear；项 3（零漂移第一手复算）clear；项 4（自证伪 + M-3/M-4 + 零残留）clear；项 5（守界/不得回退/证据有效）clear；项 6 如上。SA4 评审六项发现全部收敛：SA4-1（=我 §8-1）闭合、SA4-2 修复且裁为无冲突、SA4-3 gates 侧闭合 + 测试侧披露保留、SA4-4 于 SA3 §9.6 闭合、SA4-5 最小 diff 还原闭合、SA4-6 iter-1 已追认。iter-1 的全部 Required actions 状态：§8-1 **闭合**（含 N-6 终版重取与 SA3 报告表述更正——§9.2(a) 已如实记载「iter-1 照抄脚本局限」并由本报告核验修复）；§8-2 转为包装义务（§17-1）；§8-3 SA4 评审已到场并纳入本轮裁决；§8-4 无动作。**本实现可交 SA9/SA10 最终评审。**

## 19. requiresConflictRecheck

**false** —— iter-1 悬置的 (i) 实现后复核（§8-1 修复核验 + BASE 对账不变 + 跨行定向红 + N-6 终版留证）**已在本报告内闭合**；(iii) SA4 评审已出具且无新决策面（其唯一 MAJOR 同根已闭）；(ii) 交付摘要包装属 Controller/SA10 收口载体（§17-1），非冲突门禁事项；(iv) 无其余悬置项。后续仅当最终评审发现新决策面、或任一钉死值（T-2/R-2/I-1@rev2.1 基线/N-6 三形态）再被触碰时回 SA8。
