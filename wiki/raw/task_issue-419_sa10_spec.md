# SA10 Spec Review — issue #419（iteration 0：最终交付 `02abf66`「test(replication-protocol): guard route-key codec layout」终审）

- 任务：issue #419「路由键契约 codec 守卫测试（spec #415 T1）」——为 ADR 0032 §4 路由键契约在 `@nomicore/replication-protocol` 落地结构性守卫测试（纯增量测试，零行为变化）
- 本轮 dispatch：`sa-b7b24437-2624-4fae-815f-2d9bec06dba4`（mabf-sa10，phase **spec-review**，iteration 0）——「Review the committed final delivery for issue #419 against issue acceptance criteria, the approved SA6 contract, and applicable normative specifications」
- **审查对象：当前最终提交 `02abf66`（HEAD，工作树干净，分支 `mabf/issue-419` 领先权威父 PR #416 head `spec/415-replication-transport-decoupling` @ `27e012b6` 恰好 1 个提交）**。`27e012b6..HEAD` 全量 diff（本轮 `git show --stat` 亲证）= **1 个新测试文件**（`packages/replication-protocol/test/codec-route-key-guard.test.ts`，743 行，6 describe 组 / 19 用例）+ 10 份证据日志（5 份 `sa6-issue419-*` + 5 份 `sa3-issue419-*`）+ 10 份 `wiki/raw/task_issue-419*` 过程产物。**零 `src/`、零 fixtures、零既有测试、零文档、零配置改动**——`git diff 27e012b6..HEAD -- packages/replication-protocol/src packages/replication-protocol/test/fixtures.ts docs CONTEXT.md` 为空输出（本轮实测）
- 适用 Owner 要求：Issue 评论 REST 快照 = **空（`[]`）**（dispatch 明示，SA6 §2 同证）——无 Owner 评论要求、无评论 ID/时间戳可映射；Owner 要求 = Issue 正文（`wiki/raw/task_issue-419.md` 快照）
- 审查纪律：spec 审查。未修改任何代码/设计/测试/证据、未运行测试套件、未启动服务、未调度其他 SA。本轮证据 = 只读核验：git diff/log/status、守卫测试文件 743 行全文亲读、规范锚点现读（ADR 0032 §4 L24–26、协议 §13 L379–393）、源码锚点现读（`src/constants.ts` L15、`src/messages.ts` L46–102、`test/fixtures.ts` GOLDEN 21 条逐名清点）、5 份入库证据日志结论行逐项核对、守卫文件 sha256 与证据日志记录比对

## Verdict

**approve**（0 × BLOCKER / 0 × MAJOR / 0 × 阻断 MINOR；非阻断观察见 §4，PR 必须披露项见 §5）。

核心判定：

1. **AC1–AC5 全部 met**（§2 逐项映射，含本轮独立源码/证据核验）：13 型 namespace 域消息 + OPEN identity 两态逐型固定偏移断言 + 13 条 golden 双面（AC1）；UPDATE_CHUNK 3 kind × 首/非首 6 组合（含 kind1/kind2 首 chunk 绑定块形态）+ 3 条 chunk golden（AC2）；ERROR 四象限 + fatal=false 样本 + 最坏用例 + 2 条 golden 的 §13 字段序走查（AC3）；SD-1B 形态同源消费（20 ← codec 导出 `ENVELOPE_HEADER_BYTES`、值面 ← `encodeMessage`/`decodeMessage`/注册表、偏移 ← 差分推导，字面量单点钉死）——SA6 RK-C4 明文第二合法路径，SA8 设计门已裁定与 ADR 0032 §4 相容（AC4）；包全量 14 文件 / 233 测试全绿 + 0 类型错误 + 包 tsc exit 0（AC5，AC 点名的 envelope/golden/malformed/fuzz/test-d 套件全在日志中绿）。
2. **SA6 契约 RK-C1–C7 全部兑现**（§3 逐项）：含计数契约（≥13 型 / ≥6 chunk 组合 / ≥5 ERROR 用例 / 3 负控 / 5 变异类全部满足且多数超额）与 RK-C6 变异敏感性门禁（SA6 探针驱动两轮 `MUTATION_RESULT 6/6 expected`、EXIT=0——本轮 grep 亲证两轮结论行）。
3. **「纯增量测试，零行为变化」由 diff 事实直接兑现**：唯一产品面交付 = 单一新测试文件；冻结面（wire、21 条 golden、公共 API、协议文档、ADR、CONTEXT）逐项零触碰。
4. **交付物与上游评审对象逐字节同一**：守卫文件 sha256 `32aa83a5ffaa6a3c…` 与 `artifacts/sa3-issue419-scope-and-tsc.log` 记录一致（本轮重算比对）——SA4 approve 的对象即当前提交内容。
5. **无 scope creep**：diff 中除 ALLOW 单列的守卫文件外，其余全部为 MABF 过程产物（wiki/raw）与验收证据（artifacts/），符合仓内惯例（`wiki/raw` 既有 50+ 份 tracked SA 产物、`artifacts/` 200+ 份 tracked 证据日志）。

## 1. Reviewed inputs

| 输入 | 状态 | 本轮核验方式 |
| --- | --- | --- |
| Host 简报 `wiki/raw/task_issue-419.md`（Issue #419 正文：Parent PR #416 / What to build / AC1–AC5 / Blocked by None / Comments 空） | 已读 | 全文亲读；AC 文本为验收基准 |
| SA6 契约 `wiki/raw/task_issue-419_sa6_contract.md`（approve；RK-C1–C7 / SD-1 两案 / §12.0 门禁五条 / §12.6 计数契约） | 已读 | 全文亲读；§2/§3 逐项比对 |
| SA1 设计 `task_issue-419_design.md`（SD-1B 裁决 §7.2、守卫详案 §8、ALLOW/DENY §11、门禁 §12） | 已读 | 全文亲读；设计→实现落实面抽查 |
| SA2 评审（approve，O1–O4 非阻断）、SA8 设计门（clear / false）、SA8 实现门（clear / false）、SA4 评审（approve，O1–O4 非阻断） | 已读 | 全文亲读；finding 落实面与本轮独立结论交叉 |
| 被审对象 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（743 行） | 已读 | **全文逐行亲读**；断言面、import 面、登记块、走查器、6 组 19 用例逐一核对 |
| 证据日志：`sa3-issue419-package-suite.log`（14/233 绿 + 0 类型错误 + EXIT=0）、`scope-and-tsc.log`（TSC_EXIT=0、src diff 空）、`mutation-rerun.log`（两轮 6/6 expected）、`guard-mutation-evidence.log`（守卫级 6/6，含首轮 5/6 原始记录）、`targeted-repeat.log`（19×2、sha256 链） | 已读 | 结论行逐项亲证；哈希链比对一致 |
| 规范锚点：ADR 0032 §4（L24–26「namespaceId 恒在 [21..56]、UPDATE_CHUNK [22..57]、前缀恒 1 字节、OPEN 全解码/ERROR 有界 mini-decode、codec 侧加结构性守卫测试」）；协议 §13（L379–393 ERROR 字段表：scope→code→fatal→retryable→relatedSequence?→namespaceId?→safeMessage） | 现读 | 与守卫断言序逐字段吻合 |
| 源码事实：`src/constants.ts` L15（`ENVELOPE_HEADER_BYTES = 20`）；`src/messages.ts` L46–102（18 键注册表：3 connection + ERROR either + 14 namespace，亲数）；`test/fixtures.ts` GOLDEN 21 条逐名清点（13 域 + 3 chunk + 2 ERROR + 3 连接级，L253–400） | 现读 | 与 NC2/NC3 计数断言逐项一致 |
| Issue 评论 REST 快照 | 空（`[]`，dispatch 明示） | 无 Owner 评论要求可映射；未虚构评论义务 |

## 2. Issue 正文与 AC 逐项映射（终审结论）

| Issue 正文 / AC | 交付锚点（守卫文件行号 + 证据） | 判定 |
| --- | --- | --- |
| 正文：「锁死 namespace 域帧 namespaceId 定偏移布局（varString 前缀恒 1 字节、帧字节 [21..56]）」 | G2-a（L353–377）：14 构造逐型断言 `prefix@20 = 0x23` 且 `< 0x80`、`[21..56)` 窗口 = NS、decode 回读、注册表 scope 支撑，覆盖集与注册表推导集合**等值断言**（非手抄清单）；G1-c（L332–336）运行时前缀观察 | **met** |
| 正文：「UPDATE_CHUNK 的 kind 首字段偏移（namespaceId 在 [22..57]）」 | G3-a（L407–425）：6 组合 `kind@20`/`prefix@21 = 0x23`/`[22..57)`/CAP 门控 decode 回读/`kind ≠ 0x23` 可判别 | **met** |
| 正文：「ERROR payload 字段序（code → fatal → retryable → relatedSequence? → namespaceId? → safeMessage）」 | G4 + `walkError`（L256–308）：独立最小读取器按 §13 序（含首字节 scope）走查——fatal/retryable 紧随 code 且与 `lookupError` 注册表同源一致、relatedSequence 先于 namespaceId、safeMessage 末字段零尾随、scope⇔namespaceId 出现性等价；值面经 `decodeMessage` 交叉 | **met**（走查序与协议 §13 字段表 L379–393 逐字段亲证吻合） |
| 正文：「codec 字段序一旦漂移，测试响亮失败——edge 的 O(帧头) demux 依赖这些布局事实」 | 失败消息模板点名消息型+偏移+实测值（如 `prefix@20 = X ≠ 0x23`）；变异证据：SA6 探针矩阵两轮 6/6（M1→P1/P4、M2→P2/P4/NC2、M3→P3、M4→P1/P4，NM1/NM2 绿）+ 守卫自身跑变异副本最终轮 6/6（M1–M4 各自点亮对应守卫组） | **met** |
| 正文：「纯增量测试，零行为变化」 | `27e012b6..HEAD` diff 产品面 = 单一新测试文件；`src/`/fixtures/既有测试/文档/配置零改动（本轮实测空输出） | **met** |
| AC1：每种 namespace 域消息型各有 golden 帧断言 namespaceId 精确字节偏移与长度前缀 | G2-b（L379–401）：`GOLDEN` 过滤得**恰 13 条** namespace 域非 chunk golden 且**逐型覆盖 13 型**（集合断言），每条对 golden 冻结字节 + 带 sequence 重编码字节双面断言 `prefix@20`/`[21..56)`/decode 回读，外加字节面↔重编码面 hex 互锁 | **met** |
| AC2：UPDATE_CHUNK 三种 kind（含首 chunk 绑定块形态）的偏移断言 | G3-a 6 组合（kind1 首 = `replicationId`+`replicationEpoch` 绑定块、kind2 首 = `syncRoundId` 绑定块，L219/L221）+ G3-b 绑定块不位移（`indexOfBytes` 实测起点 = 22 且首/非首一致 + 首 chunk 必带绑定块的构造面自检，L427–450）+ G3-c 三态枚举锁 + G3-d 3 条 chunk golden 双面 | **met**（设计 §7.5 修正：`UPDATE_CHUNK_U32_MAX` golden 实为 kind2 非首——本轮 fixtures L391–400 亲证 `chunkIndex=0xfffffffe`，修正成立；首 chunk 绑定块由合成用例补齐，6 组合覆盖不减） |
| AC3：ERROR 帧（连接级/namespace 级、relatedSequence 有无）的字段序守卫 | G4-a 四象限集合等值断言（L497–502）+ fatal=false wire 样本（`ACK_TIMEOUT`，唯一 fatal=false 码）+ G4-b（`[21..56)` 是 code 不得误纳 + ≤64 预算）+ G4-c（连接级字节级无 key）+ G4-d（最坏用例公式 `1+1+35+1+1+1+5+1=46` 逐项核对，最长码动态取自 `NAMESPACE_ERRORS`）+ G4-e 2 条 ERROR golden 双面（scope 两态覆盖） | **met** |
| AC4：守卫测试与 codec 同源消费布局常量/解码器（不手抄第二份字段序，防双向漂移） | SD-1B 形态：import 面仅 `@nomicore/replication-protocol` 公开 API + `./fixtures`（L33–52，零 `../src` 深导入）；20 ← codec 导出 `ENVELOPE_HEADER_BYTES`；35/1 字面量全文件唯一钉死点（L61–62），21/22/56/57 仅经派生式出现（G1-a 唯一裸字面量断言点 L313–323）；值面 ← `encodeMessage`/`decodeMessage`/`MESSAGE_REGISTRY`/`lookupError`；偏移 ← G5 差分推导（5 代表构造，L607–647）互证 | **met**（SA6 RK-C4 明文第二条合法路径「同源解码器/行为推导」；SA8 设计门行 3 裁定 SD-1B 与 ADR 0032 §4「登记为同步维护契约」no-conflict；`walkError` 的 §13 走查序是 RK-C3 明令的断言侧独立 oracle 且经解码值面交叉，非「第二份可漂移字段序」） |
| AC5：replication-protocol 全量既有套件（envelope/golden/malformed/fuzz/test-d）绿灯 | `sa3-issue419-package-suite.log`：**14 文件 / 233 测试全绿 / Type Errors: no errors / EXIT=0**——日志亲证 envelope(13)/messages-golden(27)/malformed(37)/fuzz-property(5)/api.test-d(8) 全家族在列且绿，外加 roundtrip-truncation/version-interop/registries/package-contract/issue242/issue246/issue299×2 | **met** |
| 「Blocked by: None」+「重发：前票 #417 已关闭」 | 无等待项；#417 无追加要求 | 落实 |

## 3. SA6 契约 RK-C1–C7 逐项

| 契约条目 | 兑现证据 | 判定 |
| --- | --- | --- |
| RK-C1 逐型 golden 固定偏移（13 型 + OPEN 两态；golden 字节 + 重编码字节双面；4 断言 + 注册表 scope） | G2-a/G2-b（§2 AC1 行）；负控 NC1/NC2 在位 | met |
| RK-C2 UPDATE_CHUNK kind-first（3 kind × 首/非首；绑定块不位移；可判别；3 golden） | G3-a/b/c/d（§2 AC2 行） | met |
| RK-C3 ERROR 字段序（四象限 + 变长 code + 最坏；独立最小读取器；断言 1–7） | `walkError` + G4-a…e：scope∈{0,1} 固定偏移、code 紧随、fatal/retryable 注册表一致、marker ∈ {0,1} 且 relatedSequence 先于 namespaceId、namespaceId 前缀 1B/值 35B、safeMessage 恰好全消费、`[21..56)` 是 code + ≤64 预算、连接级字节级无 key——契约断言全覆盖且多出 fatal=false 样本与 golden 面 | met |
| RK-C4 同源消费（字面量一处集中钉死 + 允许与 `NAMESPACE_ID_RE` 文法推导的 35 交叉） | G1-a 单点钉死 + G1-b 35 与 codec 文法互证（接受面 + 实测窗口）+ G1-d 拒绝方向双向锁定（34/36 字符 → `MALFORMED_FRAME`）+ G5 差分推导；SD-1B 为契约 §12.5 明文回退路径 | met |
| RK-C5 负控 NC1–NC3 原样保留且无漂移全绿 | G6（L651–742）：NC1 连接级四帧无 key 且仍可解码；NC2 注册表 14/13 精确计数 + chunk 不得误纳；NC3 `GOLDEN.length === 21` + fixed=13/chunk=3/error=2 + 例外集合恰 8 元素逐名锁定（本轮 fixtures 21 条逐名亲证一致） | met |
| RK-C6 变异敏感性（实现票复跑 §9 矩阵并写入验证日志） | `sa3-issue419-mutation-rerun.log`：两轮 `MUTATION_RESULT 6/6 expected`、EXIT=0，失败详情与 SA6 基线逐字一致；补充守卫级证据 `guard-mutation-evidence.log` 最终轮 6/6 | met |
| RK-C7 门禁与零行为（§12.0 三命令 + src 零函数体改动） | 门禁 1（包全量 14/233 绿）、门禁 2（包 tsc TSC_EXIT=0）、门禁 4（`git diff --stat -- src` 空）全过；门禁 3（根级）延后登记见 §5 | met（门禁 3 延后属已披露 deferred 项，不阻断） |
| §12.6 计数契约 | 13 型/14 构造 + 13 golden ✓；6 chunk 组合 + 3 golden ✓；ERROR 用例 8（4 象限 + fatal-false + 最坏 + 2 golden）≥5 ✓；3 负控 ✓；5 变异类（两轮）✓ | met（多数超额） |
| §3-4 测试纪律（零 skip/only/todo/env/fallback/吞错/源码字符串断言） | 本轮对守卫文件亲读复核：无 `.skip/.only/.todo`、无 `process.env`、无文件读取、无 `toMatch`/RegExp；`must`/`mustByte`/`expectMalformed` 均为响亮失败辅助；SA4 独立 grep 同证 | met |

## 4. Findings（非阻断观察）

- **N1（守卫级变异补充证据的首轮 5/6→6/6 修正）**：`guard-mutation-evidence.log` 保留首轮 `5/6 expected / EXIT=1` 原始记录——M4（UPDATE 前插字段）额外点亮 G1-b（超设计字面的运行时窗口断言加强，SA3 已登记为偏差 1，SA4 O1 已审）。期望集修正后最终轮 6/6；全程无断言回改，属诚实证据处理。该补充证据非正式门禁（正式 RK-C6 由 SA6 探针驱动承载且两轮 6/6 绿），不影响验收。
- **N2（`walkError` 走查序为硬编码 §13 序）**：形式上是对协议字段表的一份测试内重述，但（a）SA6 RK-C3 明文规定此形态（「用独立最小读取器走 §13 序……不复制 codec 的读者」——刻意不复用 codec reader 以防编码/解码同源缺陷互抵）；（b）fatal/retryable 值面经 `lookupError` 注册表同源、整体值面经 `decodeMessage` 交叉；（c）M3 变异实测点亮走查错位。故不构成 AC4 违反，登记为设计选择的透明化。
- **N3（`ERROR_NS_PREFIX_BUDGET = 64` 为测试局部上界）**：ADR 0032 §4 仅有定性「几十字节」，64 是守卫对派生事实的锁定（实测最坏 46），非新规范预算；SA8 设计门行 10 已裁定 no-conflict，未来 edge 切片裁决预算时按 SA6 §15.3 同步该断言。

## 5. PR 必须披露项（未达成/延后事项——均不阻断，已在 SA3/SA4/SA8 产物中登记）

1. **SD-1 裁决 = SD-1B（test-only 单一事实源），SA6 推荐的 SD-1A（codec 侧导出布局常量）本票不落地**：布局字面量钉死在守卫文件登记块（L54–67），`src/constants.ts`/`src/index.ts` 零改动。依据 = Issue 正文「纯增量测试，零行为变化」+ SA6 §12.5 明文回退条款；SA8 设计门已裁定与 ADR 0032 §4 相容。**遗留 follow-up F1**：edge demux 消费者切片（#420+）落地时把布局事实升格为 `src/constants.ts` 导出常量（预留名 `NAMESPACE_ID_BYTES` 等四个），并随该票自带 SA8 冲突门禁。
2. **门禁 3（根级 `pnpm test` / `pnpm typecheck` 全仓）未在本票执行**：SA3 跑了包级门禁 1/2/4/5（全绿），根级两命令延后给 SA7/CI；SA4 O2 已静态核证两条根入口均覆盖新文件（vitest include + typecheck script 含本包 tsc），残余风险极小但**收口时须补跑**。
3. **F2（可选）：守卫文件未登记进协议 §22 conformance 资产清单**——AC 未要求；若 Controller 采纳须连带跑 D6-1 引用存在性检查（`codec-issue246-doc-contract.test.ts`）。
4. **守卫级变异驱动未持久化**：补充证据的 scratch 驱动用后即删（临时 `vitest.mutant.config.ts` 属工具范畴）；正式 RK-C6 复跑入口 = 仓内长期资产 `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（随时可复现，本轮结论行亲证两轮 6/6）。
5. **守卫文件头注维护契约（在位，L25–28）**：注册表 append-only 演进（新 namespace-scope 消息型 / 新错误码）会触发 NC2/NC3 计数或 ERROR 预算**响亮红**——这是有意识的契约修订信号（SA8 Required action 2 兑现），PR 评审者须知悉该红不是测试脆弱。

## 6. 范围与规范符合性（scope creep 复核）

- **ALLOW 符合**：唯一产品面交付 = 设计 §11 ALLOW 单列的 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（新建）。
- **DENY 全项零触碰（本轮对 `27e012b6..HEAD` diff 实证）**：`src/**`、`test/fixtures.ts`、既有 13 个测试文件、协议文档/ADR/CONTEXT、`packages/ws-replication/**`、门禁配置——全部无 modification 条目；diff 其余条目全部为 `wiki/raw/task_issue-419*` 过程产物与 `artifacts/*issue419*` 证据日志（仓内 tracked 惯例）。
- **规范文本零改动**：wire、协议 §22、ADR 0032、CONTEXT 词条均未触碰；ADR 0032 §4 的明令义务「codec 侧加结构性守卫测试」由本交付兑现（SA8 实现门行 1：`implements-existing-decision`）。
- **门禁链**：SA6 契约 approve → SA1 设计（SD-1B 裁决）→ SA8 设计门 clear/false → SA2 approve（O1–O4 已落实或采纳）→ SA3 实现（门禁全过）→ SA8 实现门 clear/false → SA4 approve（O1–O4 非阻断）。无悬而未决的阻断项。

## 7. 审查方法与限制

- 本轮为零修改静态审查 + git/证据日志只读核验：未运行任何测试、未启动服务、未修改任何被审对象（唯一写入 = 本文件）。运行性结论（14/233 绿、tsc exit 0、两轮变异 6/6、19 用例 ×2）采信入库证据日志并核对结论行、计数自洽性（13/214 基线 + 19 守卫 = 14/233）与哈希链（守卫文件 sha256 与日志记录一致）。
- SA10 不审查通用架构风格与仓库规范（SA9 职责；本 diff 无新规范面）；`approve` 不替代 SA7 对根级全仓门禁（§5-2）的最终收口验证。
