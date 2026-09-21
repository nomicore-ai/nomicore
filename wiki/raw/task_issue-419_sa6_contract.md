# task_issue-419 SA6 验收契约 — 路由键契约 codec 守卫测试（spec #415 T1）

- Issue：#419（标题「路由键契约 codec 守卫测试（spec #415 T1）」，state=open，Issue updated at 2026-09-21T14:21:34Z）
- 任务类型：**Feature / 纯增量测试**（能力缺口 = 结构性守卫与布局事实登记缺失；非 Bug——现行 codec 布局正确，无行为缺陷可修）
- HEAD：`27e012b6606e48797842a79e11e3505819c34cc6`（ADR 0032 改号提交；worktree `nomicore-fix-issue-419`）
- 结论：`approve`——能力缺口可证据化、契约断言可执行且经变异证明敏感、测试入口真实；一个范围决策（SD-1）留给 SA8 批准
- 本文件是唯一固定报告；可执行证据 = `task_issue-419_sa6_route_key_probe.mts`、`task_issue-419_sa6_route_key_mutation_driver.mts` 与 `artifacts/sa6-issue419-*.log`
- **原位修订（iteration 2，2026-09-21，evidence-contract 冲突裁决）**：§17 的登记基准修订为 **C1 规范形**（见 §17 首段），并新增 **§18**——SA3 §F1 恢复后的登记原始字节被 Controller 强制门禁 `git diff --cached --check` 以 `new blank line at EOF` 拒绝时的诊断、根因与合规修复路径。**业务契约（§12 RK-C1–RK-C7、§13、§14）与交付本体零变化**（守卫文件 `32aa83a5…`/743 行不变，`packages/**` 与 `docs/**` 对 HEAD 零 diff）；§1–§16 保留为业务交付的现时契约，其证据资产的登记值以 §17 修订版为准。

---

## 1. Task type and inputs

**读了什么**

| 输入 | 位置 | 用途 |
|---|---|---|
| Host 任务简报 | `wiki/raw/task_issue-419.md` | Issue 正文（Parent/What to build/AC1–AC5/Blocked by/Comments 空） |
| ADR 0032 §4（决策 D7/D11） | `docs/adr/0032-transport-decoupling-edge-session-split.md` L24–26 | 路由键布局事实的唯一规范来源（[21..56) / [22..57) / 前缀恒 1 字节 / ERROR 特例 mini-decode） |
| 协议规范 | `docs/protocols/instance-replication-v1.md` §1（身份文法）、§3（20-byte envelope）、§4（lib0 canonical）、§5（消息注册表+scope）、§10.3（UPDATE_CHUNK 字段表）、§13（ERROR 字段表）、§22（conformance 清单） | 字段序与布局事实的规范依据 |
| 包边界 | `packages/replication-protocol/AGENTS.md` | codec 传输无关、fail-closed、注册表 append-only、公开 API 只经 `index.ts` |
| codec 源码 | `src/constants.ts`、`src/messages.ts`、`src/envelope.ts`、`src/payloads.ts`、`src/canonical.ts`、`src/index.ts` | 断言面与被测行为；确认现无布局常量（证据 §5-B） |
| 既有测试与 fixture | `test/codec-envelope.test.ts`、`test/codec-messages-golden.test.ts`、`test/codec-issue299-ac-red.test.ts`、`test/fixtures.ts`（21 golden） | 既有最接近覆盖（§5-C）、可复用 golden 语料 |
| 本仓 runner | `vitest.config.ts`、根 `package.json`、`packages/replication-protocol/tsconfig.json` | 测试发现规则与门禁命令 |

**缺失输入（已在 §15 记录）**：SA8 固定位置产物（`task_issue-419_design.md` / `_design_conflict_report.md` / `_relevant_decisions.md`）均不存在；issue 评论 REST 快照为空（dispatch 明示 `[]`）。故契约由简报 AC + ADR/协议规范 + 源码事实推导，SD-1 需 SA8 追认。

**为什么是 Feature 而非 Bug**：ADR 0032 §4 要求「路由键布局与 codec 字段序登记为同步维护契约，codec 侧加结构性守卫测试」，而仓内既无布局事实登记（无常量/无断言，§5-A/B/D），也无 edge 消费者（§5-E）。现行 codec 行为本身**正确**（§5 探针 7/7 绿），因此不存在「旧实现失败」的红灯；本契约的可证伪性由**变异红**承载（§9、§13），而非伪造一条当前代码就红的假红灯。

## 2. Owner comment mapping

Issue 评论 REST 快照为空（`[]`），无评论 id/时间戳可映射；以下是简报正文 AC 与契约条目的逐项映射（owner 要求 = AC 文本）：

| 简报 AC | 契约条目 | 可执行证据 |
|---|---|---|
| AC1：每种 namespace 域消息型各有 golden 帧断言 namespaceId 的精确字节偏移与长度前缀 | RK-C1 | 探针 P1（14 构造 / 13 型）+ NC3（golden 语料 13 命中） |
| AC2：UPDATE_CHUNK 三种 kind（含首 chunk 绑定块形态）的偏移断言 | RK-C2 | 探针 P2（3 kind × 首/非首 = 6 组合） |
| AC3：ERROR 帧（连接级/namespace 级、relatedSequence 有无）的字段序守卫 | RK-C3 | 探针 P3（四象限 + 最坏前缀 46 字节） |
| AC4：守卫测试与 codec 同源消费布局常量/解码器（不手抄第二份字段序，防双向漂移） | RK-C4 + **SD-1** | 探针 P4（差分推导不依赖新增常量）+ P3 值面经 `decodeMessage`/错误注册表交叉核对 |
| AC5：replication-protocol 全量既有套件绿灯 | RK-C7 | `artifacts/sa6-issue419-runner-trigger.log` §3（13 文件/214 测试/0 类型错误）+ `sa6-issue419-package-tsc-baseline.log`（tsc EXIT=0） |

简报明示「纯增量测试，零行为变化」→ RK-C7 追加零行为面校验（`src/` 仅允许 SD-1 的常量追加，函数体零改动）。

## 3. SA8 constraints

无 SA8 设计产物可读。契约继承的硬约束：

1. **ADR 0032 §4（已接受）**：namespace 域帧 namespaceId 恒在帧字节 `[21..56)`；`UPDATE_CHUNK` kind 首字段 → `[22..57)`；varString 长度前缀恒 1 字节；OPEN 全解码、ERROR 走有界 mini-decode（例外两类）；「codec 侧加结构性守卫测试」是本 issue 的存在理由。
2. **协议 §22 conformance**：golden vectors / roundtrip / 逐 offset 截断 / fail-closed 分类等既有清单不得回退；新增守卫不得改变 wire。
3. **包边界（AGENTS.md）**：codec 保持传输/Registry 无关；公开 API 只经 `src/index.ts`；注册表 append-only；失败只抛 `ProtocolError`。
4. **测试纪律（SA6 契约）**：无 skip/only/todo、无 env override、无 fallback、无吞错、无源码字符串/正则断言；断言只观察运行时帧字节。
5. **SD-1（待 SA8 批准）**：见 §12——「布局事实单一事实源」是仅测试内固化还是由 codec 追加导出常量。

## 4. Environment and baseline

| 项 | 值 |
|---|---|
| 运行环境 | node `v24.13.0`、pnpm `10.28.2`、vitest `3.2.7`、tsc `5.9.3` |
| 依赖安装 | `pnpm install --frozen-lockfile --offline`（exit 0，全部自 pnpm store 复用，零下载） |
| 仓状态 | HEAD `27e012b`；`git status --porcelain` 起始仅 Host 简报未跟踪；`packages/replication-protocol/src` 全程零改动（收尾复核 `git diff` 为空） |
| 包全量套件基线 | `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/replication-protocol` → **13 文件 / 214 测试全绿 / Type Errors: no errors**（8.12s 首次，2.7s 复跑） |
| 包类型检查基线 | `pnpm exec tsc -p packages/replication-protocol/tsconfig.json` → exit 0（`tsconfig.json` include = `src/**/*.ts` + `test/**/*.ts`，故新测试文件受 `pnpm typecheck` 覆盖） |
| 探针基线 | 探针对真实 codec：**P1–P4 + NC1–NC3 全绿（7/7）**，重复 5 次全绿（§7） |

证据：`artifacts/sa6-issue419-runner-trigger.log`、`artifacts/sa6-issue419-probe-green.log`、`artifacts/sa6-issue419-package-tsc-baseline.log`。

## 5. Positive reproduction — 能力缺口证据（现行行为正确，缺的是守卫与登记）

**A. 布局事实零出现**：`grep -rnE "21\.\.56|22\.\.57|NAMESPACE_DOMAIN|ROUTE_KEY|routeKey|NS_OFFSET|LAYOUT_|route-key"` 覆盖 `packages/replication-protocol/{src,test}` 与 `packages/ws-replication/{src,test}` → **(no matches)**。ADR 0032 §4 的偏移事实只存在于 ADR 散文，仓内无任何登记点。

**B. codec 零暴露布局常量**：`grep -rnE "OFFSET|LAYOUT" packages/replication-protocol/src` → **(no matches)**。`constants.ts` 有 `ENVELOPE_HEADER_BYTES=20`、`NAMESPACE_ID_RE`，但**无** namespaceId 字节长度、前缀字节数、域内偏移、kind 首字段偏移。

**C. 既有测试的最接近覆盖（都不点名路由键事实）**：
- `codec-envelope.test.ts:52-65`：逐个 offset 断言 **20-byte 头**（0/4/5/6/8/12/16）+ 全帧 golden 等式；不进入 payload 布局。
- `codec-issue299-ac-red.test.ts:285-290`：`hexToBytes(golden.frameHex).subarray(20)[0] ∈ {0,1,2}`——只锁 UPDATE_CHUNK **首字节是 kind**，未断言 namespaceId 偏移/前缀（`frame[21]`、`[22..57)` 无断言）。
- `codec-messages-golden.test.ts`：21 条 golden 的**全帧十六进制等式**（`encodeMessage(msg) === frameHex`）。这是强约束，但它（i）不给出可消费的布局事实，（ii）不覆盖 ERROR 字段序的一般规则（只有 2 个样本），（iii）不会在断言消息里指明「路由键布局漂移」这一失败语义。

**D. 无 ERROR 字段序守卫**：`grep -rnE "walkError|field-order|namespaceId marker|relatedSequence marker"` → 仅命中 `codec-malformed.test.ts:143`（marker=02 → MALFORMED_FRAME）与 `codec-messages-golden.test.ts:296`（注释），无按 §13 顺序的字段走查。

**E. 无运行期消费者**：`packages/ws-replication/src` 无 `edge`/`session-host` 模块 → ADR 0032 决策 4 的 O(帧头) demux 尚未实现；布局事实当前**无任何登记点供其消费**，这正是本 issue 要在 codec 侧先落地的原因。

**F. 现行布局确实正确（探针 P1–P4 全绿）**——逐项实测：13 型 namespace 域消息 `frame[20]=0x23`、namespaceId ∈ `[21..56)`；UPDATE_CHUNK 3 kind × 首/非首 `frame[20]=kind`、`frame[21]=0x23`、namespaceId ∈ `[22..57)`；ERROR 四象限按 §13 序全消费且 namespaceId 变长（payload+26/27，最坏 +46）；差分值域窗口与登记字段窗口一致。**结论：任何在当前代码上「红」的路由键断言都只能是假红（环境/fixture/入口错误），不会被写进契约。**

## 6. Negative control

同一探针内三条负控（现行 codec 上全绿；实现票必须原样保留）：

| id | 断言 | 为什么是负控 |
|---|---|---|
| NC1 | HELLO / HELLO_ACK / GOAWAY / 连接级 ERROR 的帧 `[20] ≠ 0x23`、字节级不含 namespaceId 串，且仍可 `decodeMessage` | 证明「路由键」断言不是「任何帧都命中的恒真断言」；连接级帧无 key 是规则的一部分 |
| NC2 | 注册表 scope 判别：namespace-scope 恰 14 型；固定偏移规则适用 = 13（排除 UPDATE_CHUNK）；UPDATE_CHUNK 首字节必须是 kind、第二字节才是前缀；ERROR 为 `either` 例外 | 证明两条规则可判别（`[21..56)` 与 `[22..57)` 不可互相误纳） |
| NC3 | 21 条 golden 语料级判别：恰 13 条落固定偏移规则；例外集合恰 `{HELLO, HELLO_ACK, GOAWAY, ERROR_CONN, ERROR_NS, UPDATE_CHUNK_BASIC, UPDATE_CHUNK_MULTIBYTE, UPDATE_CHUNK_U32_MAX}`；3 条 chunk golden 走 kind-first 规则、2 条 ERROR golden 走字段序规则 | 语料级「计数 + 例外集合」双向锁定：规则过松（多纳）或过紧（漏纳）都红 |

变异侧负控（§9 NM1/NM2）：与路由键布局无关的改动必须保持全绿，证明断言面只锁布局字节、不锁实现写法、不越界到连接级语义。

## 7. Stability, scale and timing

- 探针是纯字节算术 + codec 公开 API，无计时器/网络/文件 IO → 确定性。**重复运行 5 次：5/5 `RESULT 7/7 passed`，exit 0。**
- 变异矩阵**重复 2 轮**：两轮均 `MUTATION_RESULT 6/6 expected`，且每轮失败 id 集合与失败详情逐字相同（`artifacts/sa6-issue419-mutation-sensitivity.log` 两段）。
- 规模/时序条件：无需并发或大载荷——布局事实是**帧头级常量**，最小输入即可暴露（最大用例仅 `UPDATE_CHUNK` 4 MiB 声明值与 35 字节 namespaceId，零实际分配）。
- 包全量套件耗时 ~3–8s（`--typecheck` 含 test-d 类型检查 2.2s），适合每次实现迭代全跑。

## 8. Capability gap（替代 Bug 根因链）

| id | 缺口 | 证据 | 影响（若漂移发生） |
|---|---|---|---|
| G1 | 布局事实无登记点：codec 不导出/不持有 namespaceId 长度、前缀宽度、`21`/`22` 偏移 | §5-A/B | 未来 edge demux 只能手抄 ADR 字面量；ADR「同步维护契约」落空 |
| G2 | 无逐型固定偏移守卫：13 型 namespace 域帧无 `[20]=0x23`+`[21..56)` 断言 | §5-C | 任一编码器前插字段/换字段序 → 60 字节定偏移读取静默错位（golden 全帧等式虽会红，但失败语义不指向路由键） |
| G3 | 无 UPDATE_CHUNK kind-first 偏移守卫 | §5-C（仅首字节 kind） | kind 与 namespaceId 次序颠倒 → `[21..56)` 提取出 35 字节垃圾；edge 定偏移读静默错路 |
| G4 | 无 ERROR 字段序守卫（四象限 × 变长 code） | §5-D | `relatedSequence`/`namespaceId` 次序互换或 marker 语义变化 → edge 的有界 mini-decode 取错 key |
| G5 | 无变异敏感性证据绑定布局事实 | §9 | 守卫写成「恒真/过松」也无从发现；布局漂移可在全绿套件下发生 |

**放大因素**：`UPDATE_CHUNK` 的 kind 恰为 `{0,1,2}`（都 < 0x23），若把 `frame[20]` 误读为 varString 前缀，`0/1/2` 会给出「长度 0/1/2」的短读而**不抛错**——静默错路由；ERROR 的 key 在变长字段后，任何「统一 [21..56)」的简化实现都会稳定取到 code 字符串。

**未证实假设**：无（所有断言都在真实 codec 字节上实测）。

**排除项**：wire 形态缺陷（排除，探针全绿）、golden 缺失（排除，21 条在库）、语言/编码不确定性（排除，canonical 前缀唯一）。

## 9. Causal experiments — 变异敏感性矩阵（生产源码零改动）

方法：把 `packages/replication-protocol/src` 复制到 `.scratch/sa6-419/mutants/<id>/src`（符号链接包内 `node_modules` 以解析 lib0），单点替换后经 `SA6_CODEC_SRC` 指向副本运行探针；运行后删除副本。**真实 `src/` 从未被写入**（收尾 `git diff -- packages/replication-protocol/src` 为空）。

| 变异 | 漂移语义 | 期望红 | 实测失败 id | 实测失败详情（首条） |
|---|---|---|---|---|
| M1 `M1-domain-field-order` | `encodeResyncRequired`：reasonCode 写到 namespaceId 之前 | P1、P4 | P1、P4 | `RESYNC_REQUIRED: prefix@20 = 11 ≠ 0x23`；`差分值域起点 36 ≠ 24` |
| M2 `M2-chunk-kind-order` | `encodeUpdateChunk`：namespaceId 写到 kind 之前 | P2、P4、NC2 | P2、P4、NC2 | `kind0/first: kind@20 = 35 ≠ 0`；`UPDATE_CHUNK/kind0: 差分值域起点 24 ≠ 25`；`UPDATE_CHUNK 首字节是 kind，不得被 [21..56) 规则误纳` |
| M3 `M3-error-field-order` | `encodeError`：namespaceId 块写到 relatedSequence 块之前 | P3 | P3 | `conn/related: namespaceId 值长度 ≠ 35`（走查在 §13 序上错位） |
| M4 `M4-domain-leading-field` | `encodeUpdate`：namespaceId 前插入前导字段 | P1、P4 | P1、P4 | `UPDATE: prefix@20 = 0 ≠ 0x23`；`差分值域起点 25 ≠ 24` |
| NM1 `NM1-neutral-refactor` | `encodeSyncApplied`：`writeVarUint32`→等价 `writeVarUint`（字节恒等） | 无（全绿） | 无（exit 0） | — |
| NM2 `NM2-connection-value-change` | `encodeGoaway`：`drainTimeoutMs+1`（连接级语义变化） | 无（全绿） | 无（exit 0） | — |

**因果读数**：
1. 每类漂移都被**对应断言**点亮（M1/M4 → 域固定偏移；M2 → kind-first；M3 → ERROR 序），失败详情点名漂移的消息型与偏移——可直接定位根因，不是模糊的帧比对失败。
2. M2 同时点亮 NC2 是**正确行为**：NC2 是判别性负控，规则塌缩时它必须红；无漂移时 NC2 绿（§6）。
3. NM1/NM2 证明断言面**只锁运行时字节布局**，不锁实现写法、不越界到连接级 payload 语义——断言既不过松也不过紧。
4. M1/M4 分别打在不同编码器上（RESYNC_REQUIRED vs UPDATE），证明 AC1 是**逐型覆盖**而非单点抽样。

命令与两轮完整输出：`artifacts/sa6-issue419-mutation-sensitivity.log`；复现：`NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（exit 0 = 6/6 符合预期）。

## 10. Impact surface

| 面 | 变化 |
|---|---|
| 新增测试 | `packages/replication-protocol/test/codec-route-key-guard.test.ts`（唯一交付文件；RK-C1–C3 + NC1–NC3） |
| 改动 fixture | 无（复用 `test/fixtures.ts` 的 21 golden；如实现票新增 ERROR/CHUNK 变体，只允许**追加**且不得改写既有 21 条字面量） |
| 生产源码 | 默认零改动；仅 SD-1 获批时允许「追加导出常量」这一种零行为变更（`src/constants.ts` + `src/index.ts`） |
| wire/协议文档 | 零改动（ADR 0032 §4 与协议 §1/§3/§10.3/§13 已是规范依据；本 issue 不新增语义） |
| 下游消费者 | 未来 `HubReplicationEdge` demux（本 worktree 尚未实现，§5-E）；SD-1 的常量是其单一事实源候选 |
| 既有套件 | 不得回退：13 文件/214 测试保持绿；新增文件后 14 文件 |

## 11. Ruled-out hypotheses

| 假设 | 结论 | 依据 |
|---|---|---|
| H1「既有 golden 全帧等式已足够，无需新增守卫」 | **排除（不足）**：golden 等式不提供可消费的布局事实、不覆盖 ERROR 一般序、失败语义不指向路由键，且 AC1–AC4 明确要求新增结构性守卫 | §5-A/B/C/D；AC 文本 |
| H2「现行 codec 有布局 Bug，契约应在当前代码变红」 | **排除**：探针 P1–P4 全绿，13 型/3 kind/四象限偏移与字段序全部符合 ADR 与协议 | §5-F、`sa6-issue419-probe-green.log` |
| H3「守卫需要改 wire 或协议文档」 | **排除**：零新语义；ADR 0032 已接受、协议已规定字段序；本 issue 是纯增量测试 | ADR 0032 §4、协议 §22 |
| H4「某种 namespace 域消息的长度前缀可能 2 字节」 | **排除**：namespaceId 文法固定 35 字节 ASCII（`ns-`+32 hex），35 < 0x80 ⟹ canonical varUint 前缀恒 1 字节；协议 §1 明文 | `NAMESPACE_ID_RE`；探针 P1/P2/P3 前缀断言 |
| H5「ERROR 也能用 [21..56) 定偏移提取」 | **排除**：ERROR 首字段是 scope(u8)+code(varString)，namespace 级 namespaceId 实测在 payload+26/27，最坏 +46；edge 必须 mini-decode | 探针 P3、ADR 0032 §4 例外条款 |
| H6「负控会与守卫一起红，无法分离」 | **排除**：无漂移时 NC1–NC3 全绿；只在 M2 这类「规则塌缩」变异下 NC2 才红，且这正是判别性负控的语义 | §6、§9 |

## 12. Acceptance contract and test paths

### 12.0 交付路径与门禁

- 新增测试：**`packages/replication-protocol/test/codec-route-key-guard.test.ts`**（新文件；`describe` 建议分 4 组：域固定偏移 / UPDATE_CHUNK kind-first / ERROR 字段序 / 负控）。
- 发现性：`vitest.config.ts` include `packages/*/test/**/*.test.ts` → 目标路径实测被发现（§14）。
- 门禁命令：
  - `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/replication-protocol`（AC5；期望 14 文件/215+ 测试全绿，Type Errors: no errors）
  - `pnpm exec tsc -p packages/replication-protocol/tsconfig.json`（新测试文件在 include 内，exit 0）
  - CI 级：根 `pnpm test` / `pnpm typecheck`
- 零行为面：`git diff --stat -- packages/replication-protocol/src` 必须为空（SD-1 未获批）或仅含常量追加行（SD-1 获批）；**任何编码/解码函数体改动都是越界**。

### 12.1 RK-C1 逐型 golden 固定偏移（AC1）

- 输入：`test/fixtures.ts` 的 `GOLDEN` 中 13 个 namespace-scope 非 `UPDATE_CHUNK` 型（OPEN_NAMESPACE、OPEN_OK、CLOSE_NAMESPACE、CLOSE_OK、BOOTSTRAP_SNAPSHOT、BOOTSTRAP_ACK、IDENTITY_CHANGED、SYNC_STEP1、SYNC_STEP2、SYNC_APPLIED、RESYNC_REQUIRED、UPDATE、UPDATE_ACK），每型 ≥1 golden；另加 `OPEN_NAMESPACE` 的 `hasLocalReplica=false` 变体（identity 两态）。
- 可观察断言（对 **golden 帧字节** 与 **`encodeMessage(golden.message)` 重编码字节** 都要成立）：
  1. `frame[20] === 0x23`（namespaceId varString 长度前缀 = 35），且 `frame[20] < 0x80`（单字节 canonical）；
  2. `utf8(frame.subarray(21, 56)) === message.namespaceId`（字节精确，含 `ns-` 字面）；
  3. `decodeMessage(frame).message.namespaceId === message.namespaceId`（值面交叉核对）；
  4. `MESSAGE_REGISTRY[kind].scope === 'namespace'`（规则适用域由注册表支撑）。
- 负控：NC1、NC2（§6）。
- 敏感度：M1（RESYNC_REQUIRED 序换）、M4（前插字段）→ 断言 1 红并点名消息型；M4 详情 `UPDATE: prefix@20 = 0 ≠ 0x23`。

### 12.2 RK-C2 UPDATE_CHUNK kind-first 偏移（AC2）

- 输入：3 kind × {首 chunk 绑定块形态, 非首 chunk 无绑定块} 共 6 组合：kind0 首/非首；kind1 首（`replicationId`+`replicationEpoch` 绑定块）/非首；kind2 首（`syncRoundId` 绑定块）/非首。至少 3 条来自 `GOLDEN` 的 chunk golden（`UPDATE_CHUNK_BASIC` kind0 首、`UPDATE_CHUNK_MULTIBYTE` kind1 非首、`UPDATE_CHUNK_U32_MAX` kind2 首+绑定块），其余合成。
- 可观察断言：`frame[20] === transferKind`；`frame[21] === 0x23`；`utf8(frame.subarray(22, 57)) === namespaceId`；`decodeMessage(frame, { selectedCapabilities: CAP_CHUNKED_UPDATE })` 回读 `transferKind`/`namespaceId` 一致；绑定块**不位移** namespaceId（首/非首同偏移）；`frame[20] !== 0x23`（两条规则必须可判别——kind 值恒 < 0x23）。
- 负控：NC2、NC3（3 条 chunk golden 走 kind-first 规则）。
- 敏感度：M2 → `kind0/first: kind@20 = 35 ≠ 0`。

### 12.3 RK-C3 ERROR 字段序（AC3）

- 输入：四象限（连接级/namespace 级 × `relatedSequence` 有无）+ 变长 code 样本 + `GOLDEN` 的 `ERROR_CONN`/`ERROR_NS` + 最坏用例（最长 namespace 错误码 `NAMESPACE_REOPEN_REQUIRES_RECONNECT`(35B) + `relatedSequence = 0xffffffff`）。
- 可观察断言（用**独立最小读取器**走 §13 序，值面与 codec 解码/注册表交叉核对，不复制 codec 的读者）：
  1. `frame[20] === scope`（0=connection / 1=namespace，固定偏移）且 `scope ∈ {0,1}`；
  2. `code` 为紧随其后的 varString；`fatal`、`retryable` 紧随并与 `CONNECTION_ERRORS`/`NAMESPACE_ERRORS` 注册表值一致；
  3. `relatedSequence` marker ∈ {0,1} 且与字段出现性一致，值 = `decodeMessage` 回读值；**该字段必须先于 namespaceId**；
  4. `namespaceId` marker ∈ {0,1} 且与 scope 等价（namespace ⇔ present）；出现时其为 varString，长度前缀 1 字节、值 35 字节；
  5. `safeMessage` 必须是末字段且**恰好全消费**（零尾随）；
  6. namespace 级：`utf8(frame[21..56)) !== namespaceId`（该窗口是 code），且 namespaceId 距 payload 起点 **≤ 64 字节**（实测最坏 46）；
  7. 连接级：帧内字节级不含 namespaceId。
- 负控：NC1（连接级 ERROR 无 key）。
- 敏感度：M3 → 走查在序上错位，`conn/related: namespaceId 值长度 ≠ 35`。

### 12.4 RK-C4 同源消费布局事实（AC4）

守卫测试**不得**在测试内手抄第二份 §6–§13 字段表/字段序。允许两种实现（SD-1 二选一，见下）：
- **同源常量**：偏移/前缀/长度事实来自 codec 包（`import { ... } from '@nomicore/replication-protocol'`），守卫用这些事实定位并断言运行时字节；
- **同源解码器/行为推导**：用 `encodeMessage`/`decodeMessage` 与错误注册表取得值面事实；偏移经**差分推导**（同型两帧仅 namespaceId 值不同 → 值域差窗 = 字段窗口去掉不变成分；探针 P4 已证可行）并与规范登记字面量交叉断言。

无论哪种，**规范登记字面量（21 / 22 / 35 / 1）必须在一处集中钉死**（并允许与 `NAMESPACE_ID_RE` 文法推导的 35 交叉核对），以保证「常量与编码器一起漂移」这种双向漂移仍会红。

### 12.5 SD-1（范围决策，待 SA8 批准）— 布局事实的单一事实源

| 选项 | 内容 | 优点 | 代价 |
|---|---|---|---|
| **SD-1A（推荐）** | 在 `src/constants.ts` **追加**冻结常量并经 `src/index.ts` 导出：`NAMESPACE_ID_BYTES = 35`、`NAMESPACE_ID_VARSTRING_PREFIX_BYTES = 1`、`NAMESPACE_DOMAIN_NAMESPACE_ID_OFFSET = ENVELOPE_HEADER_BYTES + 1`（=21）、`UPDATE_CHUNK_NAMESPACE_ID_OFFSET = 22`；守卫测试消费这些常量，并在专门用例中把它们的值钉到 ADR/协议字面量（21/22/35/1） | ADR「路由键布局登记为同步维护契约」的字面落地；未来 edge demux 有单一事实源；零行为变更（仅新增导出） | 不再是「纯测试」diff（触碰 `src/` 两文件）；需 SA8 批准该追加；`pnpm test`/`pnpm typecheck` 需复跑 |
| SD-1B（回退） | 不碰 `src/`：测试内集中钉死 21/22/35/1 + 差分推导 + 解码器/注册表交叉核对 | 严格符合「纯增量测试，零行为变化」；探针 P4 已证明可行 | 布局事实仍无 codec 侧登记点（G1 只被测试单侧冻结）；edge 仍需自行消费字面量 |

**建议**：SD-1A。ADR 0032 §4 明说该布局是「与 codec 字段序同步维护的契约」，把事实放在 codec 包内是唯一能同时服务守卫测试与 edge demux 的形态；「零行为变化」在 SD-1A 下依然成立（无函数体改动）。若 SA8 判定本 issue 必须绝对 test-only，则取 SD-1B，且 RK-C1–C3 与变异矩阵不变（探针即 SD-1B 形态的可执行证明）。

### 12.6 RK-C5/RK-C6/RK-C7

- **RK-C5 负控**：NC1/NC2/NC3 三条必须存在且无漂移时全绿（§6）。
- **RK-C6 变异敏感性**：实现票必须跑 §9 矩阵（M1–M4 红、NM1/NM2 绿）并把结果写入其验证日志；这是守卫「非恒真」的唯一证据形式。
- **RK-C7 门禁与零行为**：§12.0 三条命令 + `src` 零函数体改动。
- **计数契约（实现票自检）**：≥13 型固定偏移 + ≥6 chunk 组合 + ≥5 ERROR 用例（4 象限 + 最坏）+ 3 负控 + 5 变异类。

## 13. Red/green or baseline evidence

- **当前实现（HEAD 27e012b）预期：全绿**。守卫断言是「把已正确的布局事实固化为可执行契约」，因此本契约是 **baseline-green + mutation-red** 形态（Refactor 式基线 + Feature 式能力缺口证明），而非 Bug 式红灯。**不得**为了制造红灯而在当前代码上写失败断言——那会是假红（H2）。
- 已实测的绿：探针 P1–P4 + NC1–NC3 = 7/7（5 次重复一致）；包全量 13 文件/214 测试/0 类型错误；包 tsc exit 0。
- 已实测的红：M1–M4 各在对应断言处红，失败详情点名消息型/偏移（§9 表），两轮一致；NM1/NM2 保持绿。
- 实现票加入 guard 文件后的期望：包套件 14 文件/215+ 测试全绿（§14 已实测「占位文件参与套件」为 14/215，占位文件已删除）；变异矩阵 6/6。
- 反证（断言敏感度）：M4 只加 1 个前导字节 → `prefix@20 = 0 ≠ 0x23`；M3 只交换两个 optional 块 → ERROR 走查错位；说明断言对「最小布局扰动」敏感，不是只对整帧被破坏敏感。

## 14. Runner trigger evidence

1. **发现性实测**：临时在目标路径创建 `packages/replication-protocol/test/codec-route-key-guard.test.ts`（占位 1 用例），执行
   `NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run packages/replication-protocol/test/codec-route-key-guard.test.ts`
   → `✓ packages/replication-protocol/test/codec-route-key-guard.test.ts (1 test)`、`Test Files 1 passed (1)`、`Type Errors no errors`。**证明目标路径被仓库真实入口发现**；占位文件随即删除（`ls` 复核不存在）。
2. **占位文件参与全量套件**：同一次运行 `... vitest run --typecheck packages/replication-protocol` → 14 文件/215 测试全绿（证明新增文件会自然并入 AC5 套件）。
3. **删除占位后的洁净基线**：13 文件/214 测试全绿、0 类型错误、2.72s。
4. 全部输出：`artifacts/sa6-issue419-runner-trigger.log`（§1/§2/§3 三段）。

## 15. Unknowns and blockers

1. **SD-1 未批准**（唯一阻塞设计的事项）：是否允许 `src/constants.ts`+`src/index.ts` 追加布局常量。不阻塞测试本体——SD-1B 已由探针证明可行；但 ADR 0032 §4 的「登记」语义更契合 SD-1A，故须 SA8 裁决。
2. **SA8 产物缺失**：无设计/冲突/决策文件可对齐；本契约由简报 + ADR + 协议 + 源码推导。若 SA8 后续给出不同命名/文件划分，RK-C1–C3/NC1–NC3/变异矩阵应原样保留。
3. **edge 侧 mini-decode 预算**：契约采用实测最坏 46 字节、断言上界 64 字节。若未来 edge 设计选更紧/更宽的预算，需同步 RK-C3 第 6 条（不影响 key 位置事实）。
4. **协议 §22 资产登记**：可选把新测试文件登记进 §22（当前 §22 已为其他 issue 家族登记资产）。AC1–AC5 未要求；若做，需注意 `codec-issue246-doc-contract.test.ts` D6-1 会校验被引用测试文件名存在。
5. **未建模**：本 issue 不覆盖 OPEN 全解码路径与「合法无 sink → 合成 NAMESPACE_STATE_VIOLATION」等 edge 运行期路由分支（属 #420 及后续切片），仅覆盖其依赖的 codec 布局事实。
6. **（iteration 2 新增）证据/门禁契约冲突 = 已裁决、待 Controller 落盘**：§17 旧登记（runner-trigger.log 的原始 70 行字节流）与 Controller 强制门禁 `git diff --cached --check` 互不可满足（§18.7 根因）；合规修复 = C1 重登记（本文件 §17，SA6 职权）+ R1/R2 两处一次性字节规范化的 Controller 动作（§18.11）。SA6 未越界执行 R1/R2（两文件均不在 SA6 写权限清单内），故在 Controller 执行并重新 stage 之前，索引门禁仍为红（§18.12 记录该精确状态）。未证事实：提交期 EOF 规范化器的身份（推断，非证明，§18.14）。

## 16. Temporary diagnostics cleanup

| 临时物 | 处置 | 复核证据 |
|---|---|---|
| 变异副本 `.scratch/sa6-419/mutants/*`（含 `node_modules` 符号链接） | 驱动每次运行后删除（先 `unlink` 符号链接再 `rm -rf`，绝不递归真实依赖目录），并在收尾删除 SA6 专用 scratch 根 `.scratch/sa6-419` | 末轮运行后 `ls -d .scratch/sa6-419` → No such file；`ls .scratch/` 仅剩仓内既有 `vfsl-v1-parser` |
| `.scratch/sa6-419/`（smoke.mts 等） | 整目录删除 | 同上 |
| 发现性占位测试 `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 运行后立即删除；**该路径留给实现票，SA6 不留半成品** | `ls packages/replication-protocol/test/` 无此文件 |
| 生产源码临时改动 | **从未发生**：变异只在副本上进行 | `git diff -- packages/replication-protocol/src` 为空 |
| 保留的诊断/契约资产（非临时） | `wiki/raw/task_issue-419_sa6_route_key_probe.mts`（探针）、`wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（变异驱动）、5 个 `artifacts/sa6-issue419-*.log` | 见 §17 清单 |
| 工作树状态（收尾） | `git status --porcelain` = Host 简报 + 上述 SA6 资产；无其他脏文件 | 收尾实测 |

## 17. 证据与可复现清单（iteration 2 原位修订：登记基准 = C1 规范形）

**C1 规范形（canonical form）——仓库自身已提交的策略即定义**：`.editorconfig [*]`（`end_of_line=lf`、`insert_final_newline=true`、`trim_trailing_whitespace=true`）∩ Controller 强制门禁 `git diff --cached --check` 的默认规则集 `blank-at-eol` + `blank-at-eof`：

1. 任何 LF 之前不得有 `[ \t]`（trim 行尾空白）；
2. 文件末尾不得有 `[ \t]`；
3. 文件结尾恰一个 LF。

**本表全部 sha256 均登记 C1 形字节**。非 C1 的原始观测保留在「legacy/superseded」列，仅作历史取证，**不再具有权威性**，亦不再作为恢复目标（旧登记把不可提交的字节流定为权威，正是 §18.7 的根因）。登记哈希与门禁由此不再互相不可满足。

| 资产 | sha256（C1 登记值，截断见括号） | 说明 |
|---|---|---|
| `wiki/raw/task_issue-419_sa6_route_key_probe.mts` | `b340dcd37681d9a5…` | 7 项检查（P1–P4/NC1–NC3）最小复现探针；`SA6_CODEC_SRC` 指认被测 codec（C1 形，重算一致） |
| `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts` | `3631b43f29f3471b…` | 6 变异（M1–M4/NM1/NM2）敏感性驱动，自建副本、自清理（C1 形） |
| `artifacts/sa6-issue419-probe-green.log` | `1960c24a7011331f…` | 探针对真实 codec 全绿 7/7（C1 形） |
| `artifacts/sa6-issue419-mutation-sensitivity.log` | `c8f67f9bdf7d5921…` | 变异矩阵两轮 6/6 expected + 失败详情（C1 形） |
| `artifacts/sa6-issue419-capability-gap.log` | `b054b3c022cd7c53…` | 能力缺口 A–E 证据（C1 形） |
| `artifacts/sa6-issue419-package-tsc-baseline.log` | `1f23a7a0ed185aeb…` | 包 tsc 基线 exit 0（C1 形） |
| `artifacts/sa6-issue419-runner-trigger.log` | **`23787bf1a40c183b…`**（C1；blob `46ff267d…`，69 行/4321B，**= HEAD 已提交字节**） | 发现性 / 占位参与套件 / 洁净基线。**legacy/superseded**：`96abbb72ecefdc3a…`（70 行/4322B，blob `c183ba29…`；尾随空行违反 `blank-at-eof`，SA3 §F1 曾按旧登记恢复该字节流） |
| `artifacts/sa3-issue419-f1-evidence-restore.log` | **`3b861d2dc34eff9268…`**（C1；221 行/15420B，blob `0996a324…`） | SA3 §F1 修复取证日志（本 issue 新增资产，**过渡登记**：SA6 依 §18.3 授权链登记其 C1 形）。**legacy/superseded（历史观测，从未提交）**：`2932f2a7…`（221 行/15421B；第 20 行行尾空格违反 `blank-at-eol` 与 `.editorconfig` trim 规则）——SA3 报告 iteration 1 的该行登记由本行取代 |
| `wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh` | `b7e2011320efdc5d…`（324 行/20857B） | §18 最小复现 + 验证脚本（`report` / `--log` / `--registry` / `--apply`），自身 C1 形 |
| `artifacts/sa6-issue419-eof-gate-conflict.log` | `d152aeff053128d5…`（173 行/12258B） | §18 全量复现、规则判别、字节增量、候选/变异对照与私有索引门禁证明的原始输出；**自证 gate-clean**（行尾空白 0、无 EOF 空行、`--no-index --check` 静默、规范化净变换 0 字节） |

**修复路径（权威副本见 §18.11）**：`R1` runner-trigger.log 归一化到 C1（= `git restore --source=HEAD --staged --worktree -- <path>`，写入的正是 HEAD 已提交 blob `46ff267d…`）；`R2` f1 日志第 20 行行尾空格归零（−1 字节 @0-based 1330）；`R3` Controller `git add` 本契约 + 本脚本 + 本日志；`R4` `git diff --cached --check` 期望 rc=0（§18.16 已在私有索引副本上证明）；`R5` 提交后 `git show HEAD:artifacts/sa6-issue419-runner-trigger.log | sha256sum` == `23787bf1…`（**取代** SA3 f1 日志 §8/R1 与 SA8 §7-2 的 `96abbb72…` 期望）；`R6` 可选一次性执行 `bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --apply`。

复现命令（本 worktree，依赖已离线安装）：

```bash
# 1) 探针（期望 RESULT 7/7 passed, exit 0）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-419_sa6_route_key_probe.mts
# 2) 变异敏感性（期望 MUTATION_RESULT 6/6 expected, exit 0）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts
# 3) AC5 门禁（期望 13 文件/214 测试 → 实现票落地后 14 文件）
NODE_OPTIONS=--conditions=nomicore-source pnpm exec vitest run --typecheck packages/replication-protocol
# 4) 包类型检查
pnpm exec tsc -p packages/replication-protocol/tsconfig.json
# 5) 证据/门禁冲突复现 + 修复验证（iteration 2；§18）
bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh               # 只读诊断 + 私有索引门禁证明
bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --registry    # §17 登记值 vs 实测字节
bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --log /tmp/gate.log   # 生成 gate-clean 证据日志
# Controller：R1+R2 一次性规范化并重新 stage 恰好两路径（脚本会自证落盘哈希 = §17 登记值）
bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --apply
```

## 18. Evidence-contract 冲突裁决 — 登记原始字节 vs 强制空白门禁（iteration 2 新增）

### 18.1 Task type and inputs

- **任务类型：Bug（证据/门禁契约冲突；非业务行为缺陷）**。业务测试语义零改动：本裁决不触碰 `packages/**`、`docs/**`、`CONTEXT.md`、测试入口与任何断言（§18.9）。
- dispatch：本轮 SA6 一次性派发（`sa-d240578d…`，phase acceptance-contract）——"Resolve the evidence-contract conflict for issue #419"；Issue 评论 REST 快照 = 空（`[]`）。
- 亲读输入：`wiki/raw/task_issue-419.md`（AC1–AC5）；本契约 §17（旧登记）；`wiki/raw/task_issue-419_sa3_impl.md`（iteration 1 §F1 返工）；`wiki/raw/task_issue-419_sa9_standards.md` §3-F1；`wiki/raw/task_issue-419_sa4_review.md`（iteration 1）；`wiki/raw/task_issue-419_design.md` §11（ALLOW/DENY）；`artifacts/sa3-issue419-f1-evidence-restore.log`（全文）；`wiki/raw/task_issue-419_implementation_conflict_report.md`（SA8 §7-2/§8）；`.editorconfig`；`git 2.43.0` 实测。
- 亲跑命令：`git diff --cached --check`、`git status --porcelain -uall`、`sha256sum`/`git hash-object`/`git cat-file`/`git show HEAD:…`、`wc`、`od`、`grep -cP`、`diff`/`cmp`、`git -c core.whitespace=…`、`git -c core.attributesFile=…`、`git diff --no-index --check`、私有索引副本上的 `git update-index --add --cacheinfo` + `git diff --cached`。全部原始输出 = `artifacts/sa6-issue419-eof-gate-conflict.log`（sha256 `d152aeff…`，173 行）。

### 18.2 Owner comment mapping

REST 快照为空（dispatch 明示）：**无 Owner 评论 override、无评论 ID/时间戳可落实**。Owner 要求仍 = Issue 正文 AC1–AC5；本裁决不新增/不弱化任何 AC（§12 契约条目原样生效）。空快照约束被遵守：本裁决全部材料零评论引用。

### 18.3 授权链与约束（SA8 / SA9 / SA3）

| 来源 | 文本要点 | 对本裁决的效力 |
|---|---|---|
| 设计 §11 DENY LIST | `artifacts/sa6-issue419-*.log`、`wiki/raw/task_issue-419*.md\|.mts` = 只读输入（对**实现票**） | SA3 的恢复写属越权面 → SA9 F1 成立 |
| SA9 §3-F1 | 修复路径 1「在能恢复原字节时恢复原状」；路径 2「重登记 + 书面说明改动内容」 | 路径 1 被门禁否决（§18.7）后，**路径 2 是唯一可行且被明列的合规路径** |
| SA3 f1 日志 §8（R1/R2） | R1 期望恢复后提交 ≡ `96abbb72…`；R2「若 R1 复发，唯一剩余 SA9 认可路径 = SA6/Controller 在 §17 重登记归一化后哈希并书面说明（DENY 路径，SA6 职权）」 | 本题的预先授权；本 §18 + §17 修订即该路径的执行 |
| SA8 实现冲突报告 §7-2 / §8 | 同一 fallback 表述；R1 终态复核属 Controller | 与本裁决一致，无 override 需求 |
| 本 dispatch | 「produce an evidence-contract-compliant repair path … including any necessary updated registry/evidence」「Do not alter business test semantics」 | 写入权限 = 固定报告（本文件）+ 最小复现脚本 + 证据 |
| SA6 写权限 | 不得改生产实现；本裁决未写 `packages/**`、`docs/**`、`.editorconfig`、`.gitattributes`、`.git/index`、两件被修资产 | R1/R2 交由 Controller（§18.11）——SA6 不越界复制 F1 的越权写 |

### 18.4 环境与基线

| 项 | 值（本轮亲测） |
|---|---|
| worktree / HEAD | `/home/wangjian/nomicore-fix-issue-419`（linked worktree：`.git` 为 gitdir 文件） / `02abf662c8ab8689bc3e407921839d509539c802` |
| git | 2.43.0；`core.whitespace` **未设置**；**无** 已跟踪 `.gitattributes`；`.editorconfig` 已跟踪且 `[*]` = lf + insert_final_newline + trim_trailing_whitespace |
| 真实索引 | `/home/wangjian/nomicore/.git/worktrees/nomicore-fix-issue-419/index`，sha256 `e9fcd77115076b5a…`（全流程前后不变） |
| 已 stage 变更集 | 7 路径（2 证据 + 5 wiki 报告；§0 列表） |
| 门禁基线 | `git diff --cached --check` = **rc 2，恰 2 处**（§18.5） |

### 18.5 Positive reproduction（红灯，稳定复现）

```text
$ git diff --cached --check
artifacts/sa3-issue419-f1-evidence-restore.log:20: trailing whitespace.
+<{SP}                                   # 行尾空格（{SP} 为日志内可见化标记，非文件字节）
artifacts/sa6-issue419-runner-trigger.log:70: new blank line at EOF.
GATE_RC=2
```

字节事实（全部亲算，非采信自述）：

| 资产 | 工作树（= 旧登记原始字节） | HEAD 已提交字节 | 增量 |
|---|---|---|---|
| `artifacts/sa6-issue419-runner-trigger.log` | sha256 `96abbb72…`，70 行/4322B，blob `c183ba29…`，尾字节 `…2.18s)\n\n` | sha256 `23787bf1…`，69 行/4321B，blob `46ff267d…`，尾字节 `…2.18s)\n` | 恰 1 字节（末尾 LF）；69 行内容逐字节相同；去空白内容 sha256 `d612d99f…` 两侧一致 |
| `artifacts/sa3-issue419-f1-evidence-restore.log` | sha256 `2932f2a7…`，221 行/15421B，第 20 行 = `<`+SP+LF | 未提交（新资产） | C1 归零后 sha256 `3b861d2d…`，221 行/15420B，0-based 偏移 1330 的 `0x20` 移除；去空白内容 sha256 `97e31914…` 两侧一致 |

复现率：门禁输出本轮 ≥6 次复跑逐字符一致（确定性；索引只读）；无 CR 字节（`grep -c CR` = 0/0）。

### 18.6 Negative control（至少一个相近负控，且全绿）

1. **NC1 未受影响资产保持静默**：`git diff --cached --check -- wiki/` = rc 0；§17 其余 6 份资产实测均 **已是 C1 形**（canonical=YES）→ C1 规则不是「一刀切禁日志」。
2. **NC2 规范化即最小**：`diff` 显示 runner 恰 `70d69`（空行删除）、f1 恰 `20c20`（`< `→`<`）；行数/字节差 = −1/−1；无第三类 hunk。
3. **NC3 候选门禁静默**：`git diff --no-index --check /dev/null <C1 候选>` 两侧静默（rc 1 = 仅有差异，无空白缺陷）。
4. **MC1/MC2 变异敏感性（反证断言敏感）**：C1(runner) 追加 1 个末尾 LF → 重新报 `70: new blank line at EOF`，且哈希回到 `96abbb72…`；C1(f1) 在 0-based 1330 重新插入空格 → 重新报 `20: trailing whitespace`，且哈希回到 `2932f2a7…`。**门禁断言恰对这两处被修字节敏感**，修复不多不少。

**稳定性 / 规模 / 时序**：无竞态与性能面——全部判据为确定性字节、哈希、blob 与退出码（无并发、无超时、无 mock）。规模 = 2 文件 / 2 规则 / 变更集 9 路径；最小输入 = 单个字节（runner 的末尾 LF、f1 的第 20 行空格）。时序条件（本冲突的成因序，非竞态）：旧登记恢复（SA3）先于 Controller stage，stage 先于本裁决；R1（取 HEAD 字节）/R5（以 C1 值为判据）对规范化器再跑幂等（§18.14-1）。

### 18.7 Root-cause chain

| Step | Fact | Evidence | Confidence |
|---|---|---|---|
| 症状 | 强制 stage 门禁 rc=2，2 处具名缺陷，提交被阻断 | §18.5 门禁输出（≥6 次复跑一致） | 确定（实测） |
| 直接故障点 A | runner-trigger.log 的已 stage blob = 旧登记原始字节，末两字节 `\n\n` → 触发 `blank-at-eof` | 尾字节 `od`；`-blank-at-eof` 单独复跑后该条消失 | 确定 |
| 直接故障点 B | f1 日志第 20 行 `< ` 行尾空格 → 触发 `blank-at-eol`，且违反已提交 `.editorconfig` trim 规则 | `od`；`-blank-at-eol` 单独复跑后该条消失 | 确定 |
| 触发条件 | SA9 §3-F1 按「修复路径 1」要求恢复旧登记原始字节（SA3 从悬挂 blob `c183ba29…` 逐字节写回）；Controller 将该字节流 stage | f1 日志 §1–§4；`git hash-object` = `c183ba29…`；`git status` = ` M` | 确定 |
| **最深根因** | **§17 旧登记把「工具原始输出字节」定为权威，未定义可与提交策略共存的规范形（C1）** —— 使「字节精确登记」与「必过空白门禁」对含 EOF 空行的资产**同时不可满足**；F1 的「静默归一化」只是该结构缺陷的表层显影 | §18.4 策略事实；§18.8 规则判别与私有索引对照；§17 旧行 vs HEAD 字节 | 确定（可复算） |
| 放大因素 | (a) 登记文本在 DENY 钉死的 SA6 文件中，其他 SA 不可修订；(b) 日志转写约定（用 `< ` 表示被删空行）复制了同一违规类；(c) 未修订登记则每次 stage 必然复发 | §18.3 授权链；f1 日志 §2 转写；§18.12 | 确定 |
| 未证实假设 | 提交期 EOF 规范化器的**身份/触发时机**（只观测到其产物：HEAD blob = 旧登记 −1 LF） | §18.14 | 低（推断，已标注） |
| 已排除 | 内容损坏、业务/测试漂移、CR/EOL 混用、仓库 config/attributes override、门禁误报（§18.10） | 逐项实测 | 确定 |

### 18.8 Causal experiments（控制变量）

1. **规则判别**（唯一变量 = 被禁规则）：`-blank-at-eof` → 只剩行尾空格条；`-blank-at-eol` → 只剩 EOF 空行条；两者同禁 → rc 0。⇒ 两条缺陷分别由两规则独立触发，非其它规则/误报。
2. **Path B 反证**：`git -c core.whitespace=-blank-at-eol,-blank-at-eof` 与 `git -c core.attributesFile=<probe: artifacts/** whitespace=-…>` 均使门禁 rc 0 ⇒ 门禁可被策略静默（记录为被否路径，§18.11）。
3. **规范投影**：C1 规则（`.editorconfig` 三条 ∩ 门禁两规则）作用于两资产 → runner 得 `23787bf1…`（与 HEAD blob `46ff267d…` `cmp` 逐字节相同：**已提交字节本就是 C1 形**）；f1 得 `3b861d2d…`。
4. **私有索引对照**（真实索引的忠实副本，sha256 相同）：未改副本仍 rc 2（**忠实性对照**）；仅把两路径换成 C1 blob 后 rc **0**，变更集其余 6 路径不变（`--stat` 逐项一致）⇒ 修复因果充分且窄幅。
5. **非侵入性**：真实索引 sha256 全流程前后均为 `e9fcd771…`；被修资产工作树字节在本次诊断中未被 SA6 改动（仍为 §18.5 左列）。

### 18.9 Impact surface

- 命中面恰 2 文件 / 2 规则；`wiki/` 面 rc 0；`packages/**`、`docs/**`、`CONTEXT.md` 对 HEAD 零 diff；守卫交付 `32aa83a5…`/743 行不变；AC1–AC5 语义零改动。
- 契约面：§17 登记语义（权威 = C1 形）与 Controller stage 门禁由「互斥」转为「相容」；SA3 f1 日志 §8/R1 与 SA8 §7-2 的 `96abbb72…` 终态期望被 §17/R5 取代。
- 证据面：runner-trigger.log 的 C1 形恰为 HEAD 已提交字节，故修复后**该文件不再出现在提交变更集里**（无内容损失，无历史改写）。

### 18.10 Ruled-out hypotheses

| 假设 | 反证 |
|---|---|
| 证据内容被篡改/损坏 | 69 行内容逐字节相同、去空白哈希一致；f1 仅 1 字节行尾空白 |
| 业务/测试语义漂移 | `packages/**` 零 diff；守卫哈希不变；AC5 套件结论不重跑即不受影响 |
| CR/EOL 问题 | 两资产 CR 计数 = 0；`od` 尾字节为 `\n` |
| 门禁配置被本仓 override | `core.whitespace` 未设置；无已跟踪 `.gitattributes`；`git ls-files .editorconfig` = 1 |
| 门禁误报/工具缺陷 | `-blank-at-eol,-blank-at-eof` 可使 rc 0；两规则各自独立命中对应缺陷 ⇒ 门禁依策略如实报告 |
| 「SA3 恢复本身错误」 | 恢复判据 = 旧登记哈希，逐字节成立（blob `c183ba29…`）；错的是**旧登记把不可提交字节流定为权威**，非恢复动作 |
| 可以只改索引不改工作树蒙混过关 | 工作树非 C1 形 + 归一化器存在（§18.7）⇒ 复发风险；且留下 stage/工作树分叉（§18.12 记录） |

### 18.11 Acceptance contract（修复路径 = 可执行、可复核）

**C1 规范形**定义见 §17 首段（= 仓库自身已提交策略，非本裁决发明）。

| # | 动作 | 期望/断言 | 责任人 |
|---|---|---|---|
| R1 | `git restore --source=HEAD --staged --worktree -- artifacts/sa6-issue419-runner-trigger.log` | 工作树+索引 = C1 形 = blobs `46ff267d…` / sha256 `23787bf1…`（69 行/4321B） | Controller（SA6 未执行） |
| R2 | 对 f1 日志施加 C1 规则（去第 20 行行尾空格，−1 字节）后 `git add -- artifacts/sa3-issue419-f1-evidence-restore.log` | sha256 `3b861d2d…`（221 行/15420B，blob `0996a324…`）；除该字节外逐字节不变 | Controller（SA6 未执行） |
| R3 | `git add` 本契约 + 本脚本 + `artifacts/sa6-issue419-eof-gate-conflict.log` | 三件均 C1 形（脚本自证：行尾空白 0、无 EOF 空行、`--no-index --check` 静默） | Controller |
| R4 | `git diff --cached --check` | **rc 0，零输出**（§18.16 已在私有索引副本上证明；真实索引在 R1–R3 后等价） | Controller |
| R5 | 提交后 `git show HEAD:artifacts/sa6-issue419-runner-trigger.log \| sha256sum` | == `23787bf1…`（取代 SA3 §8/R1、SA8 §7-2 的旧期望） | Controller |
| R6 | `bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --apply` | 幂等执行 R1+R2 并自证落盘哈希 = §17 登记值 + 门禁 rc 0；哈希不符则 ABORT | Controller（可选一键） |

**被否路径（含反证）**：B1 config 静默 `-blank-at-eol,-blank-at-eof`（§18.8-2）——篡改强制门禁、与已提交 `.editorconfig` 冲突、且让 §17 继续要求不可提交字节；B2 `.gitattributes` 逐路径豁免——同上，且需设计授权、对 `artifacts/**` 形成永久盲区；B3 把 runner-trigger.log 移出提交——丢失已登记证据资产并留脏工作树，且未解 f1 同类缺陷；B4/B5 接受红灯或继续把 `96abbb72…` 定为权威——门禁硬阻断；B6 静默归一化而不重登记——正是 SA9 §3-F1 判定为 MAJOR 的缺陷本身。

**验收断言（本次裁决的完成判据）**：R4 绿 + R5 成立 + §17 全部行 `--registry` MATCH（§18.16）+ 业务语义零 diff（§18.9）。任一不成立 ⇒ 契约不成立，须回到 §18.7 重新归因。

### 18.12 Red/green evidence

- **红（现状，真实索引）**：§18.5 rc 2 / 2 处；私有索引忠实副本同样 rc 2（§18.8-4）。
- **绿（候选与私有索引）**：C1 候选 `--no-index --check` 静默；私有索引换入两 C1 blob 后 rc **0**（§18.16 记录实跑值）。
- **待绿（Controller 落盘）**：R1–R3 后真实索引 R4 才转绿——SA6 未越界执行 R1/R2（写权限外），该「待办」在本裁决中显式暴露而非掩盖。
- **未伪造**：未使用 skip/only/todo/env override/fallback；未用源码字符串断言替代行为观察（本裁决的观察面 = 字节、哈希、blob、门禁退出码与 diff 语义）。

### 18.13 Runner trigger evidence

- 门禁本体：`git diff --cached --check`（Controller 强制入口；本轮 ≥6 次复跑输出逐字符一致）。
- 复现/验证脚本：`wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh`（sha256 `b7e20113…`）——`report`/`--log`/`--registry`/`--apply` 四模式；`--log` 模式自证日志 C1（本次输出 `LOG_TRAILING_WS_LINES=0`、`LOG_BLANK_LINE_AT_EOF=0`、`LOG_NOINDEX_CHECK_RC=1`、`CANONICALIZATION_NET_CHANGED_BYTES=0`）。
- 原始日志：`artifacts/sa6-issue419-eof-gate-conflict.log`（sha256 `d152aeff…`，173 行/12258B）。
- **时序披露（诚实性）**：该日志生成于 §17 修订**之前**，故其 §0 `git status` 快照显示本契约为未修改、脚本为未跟踪——那是冲突现状的真实快照；§17 修订随后落盘（登记本脚本与本日志的哈希）。两份证据互不依赖：日志内容不含本契约任何哈希，其声明值全部为字节/哈希/blob/退出码实测。

### 18.14 Unknowns and blockers

1. **未证**：提交期 EOF 规范化器的身份（观测到的只是其产物：HEAD blob = 旧登记 −1 LF）。若 Controller 能提供该工具的事实，§17 可补注；不影响 R1–R5 的成立（R1 直接取 HEAD 字节，R5 以 C1 值为判据，规范化器再跑一次亦为幂等）。
2. **待办（非 SA6 权限）**：R1–R3 未执行 ⇒ 真实索引仍红。这是本裁决唯一的未闭合动作，已在 §15-6、§17、§18.11 三处显式登记。
3. **替代登记的后续一致性**：SA3 报告 iteration 1 中 f1 日志的 `2932f2a7…`/15421B 登记成为历史观测（该日志 §11b 自哈希本已被其 §11c 声明陈旧）——以 §17 修订行为权威。
4. 无环境缺失：门禁、git 对象库、C1 规则、私有索引实验均可复跑（§17 复现命令 5）。

### 18.15 Temporary diagnostics cleanup

| 临时物 | 处置 | 复核证据 |
|---|---|---|
| `.scratch/sa6-419-gate/`（C1 候选、变异副本、索引副本、`attrs.probe`、report.raw） | 脚本收尾 `rm -rf`，并在退出前断言目录已不存在（否则 rc 6） | 每次运行后 `ls -d .scratch/sa6-419-gate` → No such file；`.scratch/` 仅剩仓内既有 `vfsl-v1-parser` |
| 真实索引 | **从未写入** | 索引 sha256 `e9fcd771…` 全流程前后一致（§18.8-4） |
| 被修/被读资产工作树 | 本次诊断未写（R1/R2 留给 Controller） | `git status` 仍 ` M` / `A `；§18.5 左列哈希 |
| git 对象库 | 仅新增内容寻址 blob（幂等，`git hash-object -w` C1 f1 blob `0996a324…`） | §18.8-4；无 ref/index 变更 |
| 生产源码/文档/配置 | **从未发生** | `git diff HEAD -- packages docs CONTEXT.md .editorconfig` 为空 |

### 18.16 Registry & gate re-verification（本裁决落盘后实跑）

**(1) `--registry` 全行 MATCH**（命令 `bash wiki/raw/task_issue-419_sa6_whitespace_gate_check.sh --registry`，rc=0）：

| 登记行 | 实测 sha256（C1） | §17 登记 | 结论 |
|---|---|---|---|
| `probe.mts` | `b340dcd37681d9a5…` | 同 | MATCH |
| `mutation_driver.mts` | `3631b43f29f3471b…` | 同 | MATCH |
| `probe-green.log` | `1960c24a7011331f…` | 同 | MATCH |
| `mutation-sensitivity.log` | `c8f67f9bdf7d5921…` | 同 | MATCH |
| `capability-gap.log` | `b054b3c022cd7c53…` | 同 | MATCH |
| `package-tsc-baseline.log` | `1f23a7a0ed185aeb…` | 同 | MATCH |
| `runner-trigger.log` | C1 `23787bf1a40c183b…`（= HEAD blob `46ff267d…`；工作树 `96abbb72…` = 已取代 raw） | `23787bf1…` | MATCH（C1） |
| `f1-evidence-restore.log` | C1 `3b861d2dc34eff92…`（工作树 `2932f2a7…` = 已取代 raw） | `3b861d2d…` | MATCH（C1） |
| 本脚本 | `b7e2011320efdc5d…` | 同 | MATCH |
| 本日志 | `d152aeff053128d5…` | 同 | MATCH |

**(2) 终局门禁证明**（真实索引私有副本；`cp <真实索引> index.final` → `update-index --add --cacheinfo` 换入 5 个 blob：两资产 C1 + 本契约 + 本脚本 + 本日志 → `GIT_INDEX_FILE=… git diff --cached --check`）：**rc=0，零输出**。变更集 = **9 路径**：原 staged 的 f1 日志（C1 形）与 5 份 wiki 报告，加本裁决 2 个新文件（脚本、日志）；**runner-trigger.log 因 C1 形 = HEAD 已提交字节而退出变更集**（无内容损失）。真实索引 sha256 前后均为 `e9fcd77115076b5a…`（非侵入）。

**(3) 首次终局门禁发现并纠正的自身缺陷（同缺陷类的递归复现）**：本契约 §18 首次落盘版本（含 §18.16 占位段）自身即被门禁点名 `wiki/raw/task_issue-419_sa6_contract.md:461: new blank line at EOF`（该版本行号；与 runner-trigger.log 同一规则）；按 C1 规则归零尾部换行后复跑 rc=0。⇒「登记表自身必须满足 C1」由终局门禁强制而非仅口号；C1 规则对新增/修改文件（含 wiki 报告）一致适用。
