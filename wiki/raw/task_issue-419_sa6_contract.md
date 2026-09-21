# task_issue-419 SA6 验收契约 — 路由键契约 codec 守卫测试（spec #415 T1）

- Issue：#419（标题「路由键契约 codec 守卫测试（spec #415 T1）」，state=open，Issue updated at 2026-09-21T14:21:34Z）
- 任务类型：**Feature / 纯增量测试**（能力缺口 = 结构性守卫与布局事实登记缺失；非 Bug——现行 codec 布局正确，无行为缺陷可修）
- HEAD：`27e012b6606e48797842a79e11e3505819c34cc6`（ADR 0032 改号提交；worktree `nomicore-fix-issue-419`）
- 结论：`approve`——能力缺口可证据化、契约断言可执行且经变异证明敏感、测试入口真实；一个范围决策（SD-1）留给 SA8 批准
- 本文件是唯一固定报告；可执行证据 = `task_issue-419_sa6_route_key_probe.mts`、`task_issue-419_sa6_route_key_mutation_driver.mts` 与 `artifacts/sa6-issue419-*.log`

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

## 16. Temporary diagnostics cleanup

| 临时物 | 处置 | 复核证据 |
|---|---|---|
| 变异副本 `.scratch/sa6-419/mutants/*`（含 `node_modules` 符号链接） | 驱动每次运行后删除（先 `unlink` 符号链接再 `rm -rf`，绝不递归真实依赖目录），并在收尾删除 SA6 专用 scratch 根 `.scratch/sa6-419` | 末轮运行后 `ls -d .scratch/sa6-419` → No such file；`ls .scratch/` 仅剩仓内既有 `vfsl-v1-parser` |
| `.scratch/sa6-419/`（smoke.mts 等） | 整目录删除 | 同上 |
| 发现性占位测试 `packages/replication-protocol/test/codec-route-key-guard.test.ts` | 运行后立即删除；**该路径留给实现票，SA6 不留半成品** | `ls packages/replication-protocol/test/` 无此文件 |
| 生产源码临时改动 | **从未发生**：变异只在副本上进行 | `git diff -- packages/replication-protocol/src` 为空 |
| 保留的诊断/契约资产（非临时） | `wiki/raw/task_issue-419_sa6_route_key_probe.mts`（探针）、`wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts`（变异驱动）、5 个 `artifacts/sa6-issue419-*.log` | 见 §17 清单 |
| 工作树状态（收尾） | `git status --porcelain` = Host 简报 + 上述 SA6 资产；无其他脏文件 | 收尾实测 |

## 17. 证据与可复现清单

| 资产 | sha256（截断见括号） | 说明 |
|---|---|---|
| `wiki/raw/task_issue-419_sa6_route_key_probe.mts` | `b340dcd37681d9a5…` | 7 项检查（P1–P4/NC1–NC3）最小复现探针；`SA6_CODEC_SRC` 指认被测 codec |
| `wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts` | `3631b43f29f3471b…` | 6 变异（M1–M4/NM1/NM2）敏感性驱动，自建副本、自清理 |
| `artifacts/sa6-issue419-probe-green.log` | `1960c24a7011331f…` | 探针对真实 codec 全绿 7/7 |
| `artifacts/sa6-issue419-mutation-sensitivity.log` | `c8f67f9bdf7d5921…` | 变异矩阵两轮 6/6 expected + 失败详情 |
| `artifacts/sa6-issue419-capability-gap.log` | `b054b3c022cd7c53…` | 能力缺口 A–E 证据 |
| `artifacts/sa6-issue419-runner-trigger.log` | `96abbb72ecefdc3a…` | 发现性 / 占位参与套件 / 洁净基线 |
| `artifacts/sa6-issue419-package-tsc-baseline.log` | `1f23a7a0ed185aeb…` | 包 tsc 基线 exit 0 |

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
```
