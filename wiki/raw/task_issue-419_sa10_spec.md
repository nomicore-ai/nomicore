# SA10 Spec Review — issue #419（iteration 1：最终交付 HEAD `bd75a2c` 终审，含 C1 规范形证据契约修复）

- 任务：issue #419「路由键契约 codec 守卫测试（spec #415 T1）」——为 ADR 0032 §4 路由键契约在 `@nomicore/replication-protocol` 落地结构性守卫测试（纯增量测试，零行为变化）
- 本轮 dispatch：`sa-66252af4-265a-4834-87a1-a5a9b0b67cf6`（mabf-sa10，phase **spec-review**，**iteration 1**）——「Review the current committed final delivery for issue #419 against Issue acceptance criteria, approved SA6 contracts, and applicable specifications, including the C1 canonical evidence-contract repair」
- **审查对象：当前最终交付 = 分支 `mabf/issue-419` HEAD `bd75a2c8e0f729aecb2fc4b792e50d0a04f5f2b8`**「test(replication-protocol): canonicalize evidence contract」，由两个提交组成（本轮 `git log`/`merge-base` 亲证）：
  1. `02abf662`「guard route-key codec layout」——业务交付本体（守卫测试文件 + SA6/SA3 证据与过程产物，21 文件 +3212 行）；
  2. `bd75a2c8`「canonicalize evidence contract」——C1 规范形证据契约修复（4 份新证据日志 + SA6 契约 §17/§18 修订 + 复现脚本 + SA3/SA4/SA8/SA9/SA10 评审产物更新，11 文件 +2084/−192；**零 `packages/**` 改动**）。
  权威父 PR #416 head `spec/415-replication-transport-decoupling` @ `27e012b6606e48797842a79e11e3505819c34cc6` 经 `git merge-base --is-ancestor` 亲证为 HEAD 祖先（恰好领先 2 个提交）。
- 适用 Owner 要求：Issue 评论 REST 快照 = **空（`[]`）**（dispatch 明示，SA6 §2/§18.2 同证）——无 Owner 评论要求、无评论 ID/时间戳可映射；Owner 要求 = Issue 正文（`wiki/raw/task_issue-419.md` 快照，Comments 节空）。
- 审查纪律：spec 审查。本轮未修改任何代码/设计/测试/证据、未运行测试套件、未启动服务、未调度其他 SA（唯一写入 = 本文件原位更新）。证据 = 只读核验 + **现场重算**（不采信链上值，SA9 §4-O3 纪律）：git diff/log/status/merge-base、守卫测试文件 743 行全文亲读、§17 登记表 10 行 sha256 逐行重算（工作树与 HEAD 双侧面）、交付区间 `git diff --check`、规范锚点现读（ADR 0032 §4、协议 §13）、源码锚点现读（注册表 18 键、fixtures 21 条逐名清点）、入库证据日志结论行逐项核对。
- 与 iteration 0 的关系：iteration 0 报告（dispatch `sa-b7b24437`，终审 `02abf66`，approve）已随交付入库（89 行）；本报告为 iteration 1 原位更新，被审对象扩大为含 C1 修复的最终交付，iteration 0 的 AC/契约逐项结论经本轮独立重算延续成立。

## Verdict

**approve**（0 × BLOCKER / 0 × MAJOR / 0 × 阻断 MINOR；非阻断观察见 §4，PR 必须披露项见 §5）。

核心判定：

1. **AC1–AC5 全部 met**（§2 逐项映射，含本轮独立源码/证据核验），Issue 正文「codec 字段序一旦漂移，测试响亮失败」由变异敏感性双证据承载，「纯增量测试，零行为变化」由交付区间 diff 事实直接兑现。
2. **SA6 契约 RK-C1–C7 全部兑现**（§3 逐项）：含计数契约（多数超额）与 RK-C6 变异敏感性门禁（两轮 `MUTATION_RESULT 6/6 expected`、EXIT=0，本轮 grep 亲证结论行）。
3. **C1 规范形证据契约修复在已提交终态完整成立**（§3-C1 表，本轮全部现场重算）：§17 登记表 **10/10 MATCH**（工作树与 HEAD 双侧面均 = C1 登记值）；R5 提交后终态期望已满足——`git show HEAD:artifacts/sa6-issue419-runner-trigger.log | sha256sum` = `23787bf1a40c183b…`（blob `46ff267d…`）、`git show HEAD:artifacts/sa3-issue419-f1-evidence-restore.log` = `3b861d2dc34eff92…`（blob `0996a324…`）；`git diff --check 27e012b6..HEAD` **rc=0**（已提交交付全区间空白门禁绿）；raw blob `c183ba29…` 不再被任何登记行或 HEAD 条目引用（仅存对象库作历史取证）。SA9 §3-F1 的修复路径 2（重登记 + 书面说明）两要件均已兑现。
4. **交付物与上游评审对象逐字节同一**：守卫文件 sha256 `32aa83a5ffaa6a3c…`/743 行（本轮重算）与 SA3/SA4/SA9/SA10-it0 四方登记一致；`bd75a2c8` 未触碰任何业务字节。
5. **无 scope creep**（§6）：交付区间产品面 = 唯一新测试文件；其余全部为 MABF 过程产物（wiki/raw）与验收证据（artifacts/），符合仓内 tracked 惯例。

## 1. Reviewed inputs

| 输入 | 状态 | 本轮核验方式 |
| --- | --- | --- |
| Host 简报 `wiki/raw/task_issue-419.md`（Issue #419 正文：Parent PR #416 / What to build / AC1–AC5 / Blocked by None / Comments 空） | 已读（已入库，工作树 == HEAD） | 全文亲读；AC 文本为验收基准 |
| SA6 契约 `wiki/raw/task_issue-419_sa6_contract.md`（approve；iteration 2 原位修订版，479 行：RK-C1–C7 / SD-1 两案 / §12.0 门禁 / §12.6 计数契约 / §17 C1 登记基准 + legacy 行 / §18 冲突裁决） | 已读（工作树 == HEAD） | 全文亲读；§2/§3 逐项比对；§17 登记值 10 行本轮逐行现场重算（§3-C1） |
| SA1 设计 `task_issue-419_design.md`（SD-1B 裁决 §7.2、守卫详案 §8、ALLOW/DENY §11、门禁 §12、SA6 笔误修正 §7.5） | 已读 | 全文亲读；设计→实现落实面逐项核对 |
| SA2 评审（approve，O1–O4 非阻断）、SA8 设计门（clear / false，SD-1B 与 ADR 0032 §4 相容裁定）、SA8 实现门 iteration 2（clear / false，8 项对照 2×implements-existing-decision + 6×no-conflict）、SA4 评审 iteration 3（approve，现场重算方法） | 已读 | 全文亲读；finding 落实面与本轮独立结论交叉 |
| SA9 标准审查 iteration 0（reject，唯一阻断 §3-F1 MAJOR：只读证据资产静默漂移；修复路径 2 = 重登记 + 书面说明） | 已读（已入库，71 行） | 全文亲读；F1 修复兑现面 = 本轮 §3-C1 核验对象 |
| 被审对象 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（743 行，6 describe 组 / 19 用例） | 已读 | **全文逐行亲读**；sha256 `32aa83a5ffaa6a3c…` 现场重算；`it(` 计数 19（G1 4 / G2 2 / G3 4 / G4 5 / G5 1 / G6 3）亲数 |
| 证据日志：`sa3-issue419-package-suite.log`（**14 文件 / 233 测试全绿 / Type Errors: no errors / EXIT=0**）、`scope-and-tsc.log`（**TSC_EXIT=0**、src diff 空）、`mutation-rerun.log`（**两轮 6/6 expected**，L25/L51）、`guard-mutation-evidence.log`（首轮 5/6 原始记录 + 最终轮 6/6）、`targeted-repeat.log`（19 passed ×2）、`c1-staging-verification.log`（294 行 / `676ac387…`）、`index-reconcile.log`（181 行 / `34aa27a4…`；pre `GATE_RC=2` → post `GATE_RC=0`）、`sa6-issue419-eof-gate-conflict.log`（173 行 / `d152aeff…`） | 已读 | 结论行逐项亲证；哈希现场重算与登记/报告值一致 |
| 规范锚点：ADR 0032 §4（L24–26「namespaceId 恒在 [21..56]、UPDATE_CHUNK [22..57]、前缀恒 1 字节、OPEN 全解码/ERROR 有界 mini-decode、codec 侧加结构性守卫测试」）；协议 §13（ERROR 字段表） | 现读 | 与守卫断言序逐字段吻合 |
| 源码事实：`src/messages.ts` L80–102（注册表 18 键 = 3 connection + ERROR either + 14 namespace，亲数）；`src/constants.ts`（`ENVELOPE_HEADER_BYTES = 20`）；`test/fixtures.ts` GOLDEN **21 条逐名清点**（13 域 + 3 chunk + 2 ERROR + 3 连接级）；`UPDATE_CHUNK_U32_MAX` 实为 kind2 **非首**（L391–400，`chunkIndex=0xfffffffe`，无 syncRoundId 绑定块——设计 §7.5 修正成立） | 现读 | 与 NC2/NC3 计数断言逐项一致 |
| Issue 评论 REST 快照 | 空（`[]`，dispatch 明示） | 无 Owner 评论要求可映射；未虚构评论义务 |

## 2. Issue 正文与 AC 逐项映射（终审结论，基于已提交交付 HEAD `bd75a2c8`）

| Issue 正文 / AC | 交付锚点（守卫文件行号 + 证据） | 判定 |
| --- | --- | --- |
| 正文：「锁死 namespace 域帧 namespaceId 定偏移布局（varString 前缀恒 1 字节、帧字节 [21..56]）」 | G2-a（L353–377）：14 构造逐型断言 `prefix@20 = 0x23` 且 `< 0x80`、`[21..56)` 窗口 = NS、decode 回读、注册表 scope 支撑，覆盖集与注册表推导集合**等值断言**；G1-c（L332–336）运行时前缀观察 | **met** |
| 正文：「UPDATE_CHUNK 的 kind 首字段偏移（namespaceId 在 [22..57]）」 | G3-a（L407–425）：6 组合 `kind@20`/`prefix@21 = 0x23`/`[22..57)`/CAP 门控 decode 回读/`kind ≠ 0x23` 可判别 | **met** |
| 正文：「ERROR payload 字段序（code → fatal → retryable → relatedSequence? → namespaceId? → safeMessage）」 | G4 + `walkError`（L256–308）：独立最小读取器按 §13 序（含首字节 scope）走查——fatal/retryable 紧随 code 且与 `lookupError` 注册表同源一致、relatedSequence 先于 namespaceId、safeMessage 末字段零尾随、scope⇔namespaceId 出现性等价；值面经 `decodeMessage` 交叉 | **met**（走查序与协议 §13 字段表逐字段亲证吻合） |
| 正文：「codec 字段序一旦漂移，测试响亮失败——edge 的 O(帧头) demux 依赖这些布局事实」 | 失败消息模板点名消息型+偏移+实测值；变异证据：SA6 探针矩阵两轮 6/6（M1→P1/P4、M2→P2/P4/NC2、M3→P3、M4→P1/P4，NM1/NM2 绿）+ 守卫自身跑变异副本最终轮 6/6 | **met** |
| 正文：「纯增量测试，零行为变化」 | `27e012b6..HEAD` diff 产品面 = 单一新测试文件；`git diff 27e012b6..HEAD -- packages/replication-protocol/src packages/replication-protocol/test/fixtures.ts docs CONTEXT.md` 空输出（本轮实测）；C1 修复提交 `bd75a2c8` 零 `packages/**` 改动 | **met** |
| AC1：每种 namespace 域消息型各有 golden 帧断言 namespaceId 精确字节偏移与长度前缀 | G2-b（L379–401）：`GOLDEN` 过滤得**恰 13 条** namespace 域非 chunk golden 且**逐型覆盖 13 型**（集合断言），每条对 golden 冻结字节 + 带 sequence 重编码字节双面断言，外加字节面↔重编码面 hex 互锁 | **met** |
| AC2：UPDATE_CHUNK 三种 kind（含首 chunk 绑定块形态）的偏移断言 | G3-a 6 组合（kind1 首 = `replicationId`+`replicationEpoch` 绑定块、kind2 首 = `syncRoundId` 绑定块，L219/L221）+ G3-b 绑定块不位移（`indexOfBytes` 实测起点 = 22 且首/非首一致 + 首 chunk 必带绑定块构造面自检）+ G3-c 三态枚举锁 + G3-d 3 条 chunk golden 双面 | **met**（设计 §7.5 修正经本轮 fixtures L391–400 亲证成立：`UPDATE_CHUNK_U32_MAX` 为 kind2 非首；首 chunk 绑定块由合成用例补齐，6 组合覆盖不减） |
| AC3：ERROR 帧（连接级/namespace 级、relatedSequence 有无）的字段序守卫 | G4-a 四象限集合等值断言 + fatal=false wire 样本（`ACK_TIMEOUT`）+ G4-b（`[21..56)` 是 code 不得误纳 + ≤64 预算）+ G4-c（连接级字节级无 key）+ G4-d（最坏公式 `1+1+35+1+1+1+5+1=46` 逐项核对，最长码动态取自 `NAMESPACE_ERRORS`）+ G4-e 2 条 ERROR golden 双面（scope 两态） | **met** |
| AC4：守卫测试与 codec 同源消费布局常量/解码器（不手抄第二份字段序，防双向漂移） | SD-1B 形态：import 面仅 `@nomicore/replication-protocol` 公开 API + `./fixtures`（L33–52，零 `../src` 深导入）；20 ← codec 导出 `ENVELOPE_HEADER_BYTES`；35/1 字面量全文件唯一钉死点（L61–62），21/22/56/57 仅经派生式出现（G1-a 唯一裸字面量断言点 L313–323）；值面 ← `encodeMessage`/`decodeMessage`/`MESSAGE_REGISTRY`/`lookupError`；偏移 ← G5 差分推导（5 代表构造，L607–647）互证 | **met**（SA6 RK-C4 明文第二条合法路径「同源解码器/行为推导」；SA8 设计门裁定 SD-1B 与 ADR 0032 §4「登记为同步维护契约」no-conflict；`walkError` 的 §13 走查序是 RK-C3 明令的断言侧独立 oracle 且经解码值面交叉，非「第二份可漂移字段序」） |
| AC5：replication-protocol 全量既有套件（envelope/golden/malformed/fuzz/test-d）绿灯 | `sa3-issue419-package-suite.log`：**14 文件 / 233 测试全绿 / Type Errors: no errors / EXIT=0**——AC 点名的 envelope/golden/malformed/fuzz-property/api.test-d 全家族在列且绿（计数自洽：基线 13/214 + 守卫 19 = 14/233） | **met** |
| 「Blocked by: None」+「重发：前票 #417 已关闭」 | 无等待项；#417 无追加要求 | 落实 |

## 3. SA6 契约逐项（含 iteration 2 C1 修订）

### 3.1 业务契约 RK-C1–C7（§1–§16，交付本体面）

| 契约条目 | 兑现证据 | 判定 |
| --- | --- | --- |
| RK-C1 逐型 golden 固定偏移（13 型 + OPEN 两态；golden + 重编码双面；4 断言 + 注册表 scope） | G2-a/G2-b（§2 AC1 行）；负控 NC1/NC2 在位 | met |
| RK-C2 UPDATE_CHUNK kind-first（3 kind × 首/非首；绑定块不位移；可判别；3 golden） | G3-a/b/c/d（§2 AC2 行） | met |
| RK-C3 ERROR 字段序（四象限 + 变长 code + 最坏；独立最小读取器；断言 1–7） | `walkError` + G4-a…e：scope∈{0,1} 固定偏移、code 紧随、fatal/retryable 注册表一致、marker ∈ {0,1} 且 relatedSequence 先于 namespaceId、namespaceId 前缀 1B/值 35B、safeMessage 恰好全消费、`[21..56)` 是 code + ≤64 预算、连接级字节级无 key | met |
| RK-C4 同源消费（字面量一处集中钉死 + 文法推导 35 交叉） | G1-a 单点钉死 + G1-b 35 与 codec 文法互证 + G1-d 拒绝方向双向锁定（34/36 字符 → `MALFORMED_FRAME`）+ G5 差分推导；SD-1B 为契约 §12.5 明文回退路径 | met |
| RK-C5 负控 NC1–NC3 原样保留且无漂移全绿 | G6（L651–742）：NC1 连接级四帧无 key 且仍可解码；NC2 注册表 14/13 精确计数 + chunk 不得误纳（本轮注册表 18 键亲数一致）；NC3 `GOLDEN.length === 21` + fixed=13/chunk=3/error=2 + 例外集合恰 8 元素逐名锁定（本轮 fixtures 21 条逐名亲证一致） | met |
| RK-C6 变异敏感性（复跑 §9 矩阵并写入验证日志） | `sa3-issue419-mutation-rerun.log`：两轮 `MUTATION_RESULT 6/6 expected`、EXIT=0；补充守卫级证据最终轮 6/6 | met |
| RK-C7 门禁与零行为（§12.0 命令 + src 零函数体改动） | 门禁 1（14/233 绿）、门禁 2（TSC_EXIT=0）、门禁 4（src diff 空）全过；门禁 3（根级）延后登记见 §5-2 | met（门禁 3 延后属已披露 deferred 项，不阻断） |
| §12.6 计数契约 | 13 型/14 构造 + 13 golden ✓；6 chunk 组合 + 3 golden ✓；ERROR 用例 8 ≥5 ✓；3 负控 ✓；5 变异类（两轮）✓ | met（多数超额） |
| §3-4 测试纪律（零 skip/only/todo/env/fallback/吞错/源码字符串断言） | 本轮对守卫文件独立 grep：`skip/only/todo`、`process.env`、`readFileSync`、`toMatch`/`RegExp` **零命中**；`must`/`mustByte`/`expectMalformed` 均为响亮失败辅助 | met |

### 3.2 C1 规范形证据契约修复（§17 修订版 + §18 裁决）——本轮全部现场重算

| 核验项（契约锚点） | 本轮实测 | 判定 |
| --- | --- | --- |
| §17 登记表 10 行（探针 `b340dcd3…` / 驱动 `3631b43f…` / probe-green `1960c24a…` / mutation-sensitivity `c8f67f9b…` / capability-gap `b054b3c0…` / package-tsc-baseline `1f23a7a0…` / runner C1 `23787bf1…` / f1 C1 `3b861d2d…` / 脚本 `b7e20113…` / 冲突日志 `d152aeff…`） | 逐行 `sha256sum` 重算：**工作树 10/10 MATCH 且 HEAD 10/10 MATCH**（双侧面一致） | 兑现 |
| §18.11 R1/R4（runner 归一至 C1 = HEAD 字节，路径退出变更集；门禁 rc=0） | HEAD 条目 = blob `46ff267d3451c22147b759002aee3345d09871a9`（69 行/4321B，`git ls-tree` 亲证）；runner 不在交付区间 diff 中（`02abf66` 入库时即为 C1 形）⟹ 退出变更集成立；`git diff --check 27e012b6..HEAD` **rc=0**（已提交交付全区间无 blank-at-eol/blank-at-eof） | 兑现 |
| §18.11 R2（f1 日志第 20 行行尾空格归零 → C1） | HEAD 条目 = blob `0996a3249e81f201f57aafb8278f5a4e4b11948c`（221 行/15420B）；sha256 `3b861d2d…` = §17 登记值 | 兑现 |
| §18.11 R5（提交后终态复核，取代旧期望 `96abbb72…`） | `git show HEAD:…runner… | sha256sum` = **`23787bf1a40c183b…`**；`git show HEAD:…f1…` = **`3b861d2dc34eff92…`** —— 两期望值在已提交 HEAD 上成立 | 兑现（Controller 复核项已由本轮独立重算预证） |
| §18.9（业务语义零改动；守卫 `32aa83a5…`/743 行不变） | `bd75a2c8` 零 `packages/**` 改动；守卫 sha256 本轮重算 = 四方登记值；`git diff 27e012b6..HEAD --stat -- packages docs CONTEXT.md .editorconfig vitest.config.ts` 仅守卫文件 1 行条目 | 兑现 |
| legacy/superseded 保留（旧 raw `96abbb72…` / `2932f2a7…` 留痕并附理由，不再为权威/恢复目标） | §17 文本在位（L285/L286）；raw blob `c183ba29…` 不被任何 HEAD 条目或登记行引用（仅对象库历史取证，SA4 it3 fsck 亲证 unreachable） | 兑现 |
| SA9 §3-F1 修复路径 2 两要件（§17 重登记 + 书面说明改动内容与原因） | 重登记 = §17 C1 修订（SA6 职权内自修订）；书面说明 = SA3 报告偏差 4/5/6 + 三轮提交消息 + §18.7 根因链；SA8 实现门 §2-行1 判 `implements-existing-decision`、§7-2 确认要件满足 | 兑现（**闭合判定本身属 SA9 职权**，尚未排期——登记为 §5-6 披露项，非 spec 缺陷） |
| §18.16 终局门禁证明（私有索引 rc=0；9 路径变更集） | 已被后续事实超越：修复已**实际入库**（`bd75a2c8`），真实历史门禁等价物 = 本轮 `git diff --check 27e012b6..HEAD` rc=0 | 兑现 |

## 4. Findings（非阻断观察）

- **N1（守卫级变异补充证据的首轮 5/6→6/6 修正）**：`guard-mutation-evidence.log` 保留首轮 `5/6 expected / EXIT=1` 原始记录——M4 额外点亮 G1-b（超设计字面的运行时窗口断言加强，SA3 偏差 1 已登记、SA4 已审）；期望集修正后最终轮 6/6；全程无断言回改，属诚实证据处理。该补充证据非正式门禁（正式 RK-C6 由 SA6 探针驱动承载且两轮 6/6 绿），不影响验收。
- **N2（`walkError` 走查序为硬编码 §13 序）**：形式上是对协议字段表的测试内重述，但（a）SA6 RK-C3 明文规定此形态（刻意不复用 codec reader 防编码/解码同源缺陷互抵）；（b）fatal/retryable 值面经 `lookupError` 注册表同源、整体值面经 `decodeMessage` 交叉；（c）M3 变异实测点亮走查错位。不构成 AC4 违反，登记为设计选择的透明化。
- **N3（`ERROR_NS_PREFIX_BUDGET = 64` 为测试局部上界）**：ADR 0032 §4 仅有定性「几十字节」，64 是守卫对派生事实的锁定（实测最坏 46），非新规范预算；SA8 设计门已裁定 no-conflict，未来 edge 切片裁决预算时按 SA6 §15.3 同步该断言。
- **N4（工作树残留一份未入库的评审产物更新）**：`git status` 亲证当前工作树唯一改动 = ` M wiki/raw/task_issue-419_sa4_review.md`（SA4 iteration 3 原位更新，126+/133−；HEAD 已入库版为 iteration 1 文本）。这是 SA4 §12-O10 自登记的「待 Controller re-stage」事项，属流程产物 staging 待办，**不属已提交交付的一部分**，对业务字节与 spec 结论零影响（本报告亦不依赖其未入库内容——SA4 iteration 3 的全部关键事实已由本轮独立重算覆盖）。

## 5. PR 必须披露项（未达成/延后事项——均不阻断，已在上游产物中登记）

1. **SD-1 裁决 = SD-1B（test-only 单一事实源），SA6 推荐的 SD-1A（codec 侧导出布局常量）本票不落地**：布局字面量钉死在守卫文件登记块（L54–67），`src/constants.ts`/`src/index.ts` 零改动。依据 = Issue 正文「纯增量测试，零行为变化」+ SA6 §12.5 明文回退条款；SA8 设计门已裁定与 ADR 0032 §4 相容。**遗留 follow-up F1**：edge demux 消费者切片（#420+）落地时把布局事实升格为 `src/constants.ts` 导出常量（预留名 `NAMESPACE_ID_BYTES` 等四个），并随该票自带 SA8 冲突门禁。
2. **门禁 3（根级 `pnpm test` / `pnpm typecheck` 全仓）未在本票执行**：SA3 跑了包级门禁 1/2/4/5（全绿），根级两命令延后 SA7/CI；SA4 已静态核证两条根入口均覆盖新文件，残余风险极小但**收口时须补跑**。
3. **F2（可选）：守卫文件未登记进协议 §22 conformance 资产清单**——AC 未要求；若 Controller 采纳须连带跑 D6-1 引用存在性检查（`codec-issue246-doc-contract.test.ts`）。
4. **守卫级变异驱动未持久化**：补充证据的 scratch 驱动用后即删；正式 RK-C6 复跑入口 = 仓内长期资产 `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（随时可复现，两轮 6/6 结论行本轮亲证）。
5. **守卫文件头注维护契约（在位，L25–28）**：注册表 append-only 演进（新 namespace-scope 消息型 / 新错误码）会触发 NC2/NC3 计数或 ERROR 预算**响亮红**——这是有意识的契约修订信号（SA8 Required action 2 兑现），PR 评审者须知悉该红不是测试脆弱。
6. **SA9 §3-F1 的闭合判定尚未由 SA9 复审作出**：F1 修复路径 2 两要件（§17 C1 重登记 + 书面说明）已兑现且经 SA8 §7-2 / SA4 it3 / 本轮 SA10 三方独立重算证实；但「reject → approve」的形式闭合属 SA9 职权（SA8 §7-2 明示），iteration 1 的 SA9 复审未排期（Controller 排程事项）。SA6 §18.14-1 的「提交期 EOF 归一化器身份」保持「推断（非证明）」标注——不影响 R5 成立（本轮已在 HEAD 实测两期望值）。
7. **流程产物 staging 待办（N4）**：SA4 iteration 3 报告的 re-stage（SA4 §12-O10 + §11 登记的配套门禁复核）；本 SA10 iteration 1 报告亦为未入库新增——两者均待 Controller 随收口 stage。已提交交付本身 `git diff --check 27e012b6..HEAD` rc=0，无空白门禁风险敞口。

## 6. 范围与规范符合性（scope creep 复核）

- **ALLOW 符合**：唯一产品面交付 = 设计 §11 ALLOW 单列的 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（新建，743 行）。
- **DENY 全项零触碰（本轮对 `27e012b6..HEAD` 全区间 diff 实证）**：`src/**`、`test/fixtures.ts`、既有 13 个测试文件、协议文档/ADR/CONTEXT、`packages/ws-replication/**`、门禁配置（`vitest.config.ts`/`package.json`/`tsconfig*`/`.editorconfig`）——全部无 modification 条目；区间 diff 共 28 路径 = 1 产品文件 + 14 份 `artifacts/*issue419*` 证据日志 + 13 份 `wiki/raw/task_issue-419*` 过程产物（仓内 tracked 惯例）。
- **DENY 资产的受权写史已收口归零**：`artifacts/sa6-issue419-runner-trigger.log`（设计 §11 钉为只读）历经 iteration 1 恢复 raw（SA9 路径 1）→ iteration 2 归一 C1（SA6 §18.11 R1 worktree 半边）→ iteration 3 索引落盘（dispatch 明示 × R1 staged 半边）→ **终态入库 = HEAD 已提交 C1 字节**，路径与 HEAD 零差异、退出变更集，DENY 偏离归零；授权链（SA6 owner 裁决 + Controller dispatch 下放 + SA8 两道门 clear）书面完整。
- **规范文本零改动**：wire、协议 §22、ADR 0032、CONTEXT 词条均未触碰；ADR 0032 §4 的明令义务「codec 侧加结构性守卫测试」由本交付兑现（SA8 实现门：`implements-existing-decision`）。
- **门禁链**：SA6 契约 approve（含 iteration 2 C1 修订）→ SA1 设计（SD-1B 裁决）→ SA8 设计门 clear/false → SA2 approve（O1–O4 已落实或采纳）→ SA3 实现 iteration 0–3（门禁全过 + C1 修复落盘）→ SA8 实现门 iteration 2 clear/false → SA4 iteration 3 approve。SA9 iteration 0 的 reject（F1）所涉修复要件已兑现，形式闭合待 SA9 复审（§5-6）。无悬而未决的 spec 阻断项。

## 7. 审查方法与限制

- 本轮为零修改静态审查 + git/证据日志只读核验与现场重算：未运行任何测试、未启动服务、未修改任何被审对象（唯一写入 = 本文件原位更新）。运行性结论（14/233 绿、tsc exit 0、两轮变异 6/6、19 用例 ×2、守卫级变异 6/6）采信入库证据日志并核对结论行、计数自洽性（13/214 基线 + 19 守卫 = 14/233）与哈希链（守卫文件、§17 全 10 行、SA3 三份新证据日志的 sha256 均现场重算一致）。
- SA10 不审查通用架构风格与仓库规范（SA9 职责）；`approve` 不替代 SA7 对根级全仓门禁（§5-2）的最终收口验证，亦不替代 SA9 对 F1 的形式闭合判定（§5-6）与 Controller 对流程产物的 re-stage（§5-7）。
