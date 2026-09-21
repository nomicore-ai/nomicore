# SA9 Standards Review — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（**rebase 后最终交付**轮）

- Dispatch：`sa-d6160396-492c-44c7-a2f5-7d42952d2602`（mabf-sa9 / standards-review / iteration 0）
- 审查对象：worktree `/home/wangjian/nomicore-fix-issue-420`（分支 `mabf/issue-420`）的 **rebased 最终交付**：
  - `9d2500dd84f59c0bfaa94c53eb1e9966cec82b42`（`feat(ws-replication): expose session host factory`，父 = **`1f5809b001c984e63fac3bafd4c1f3febc76e8a8`** = 权威 Parent #416 head / PR #427 merge，issue #421）——pre-rebase 交付 `a315e7077576951cf0330596cdc588afbeca51be` 的重放，唯一冲突 `src/index.ts` 按 SA8 授权机械并集消解
  - `52a9e56534d56a75127207b2b9044afa8c3a27b0`（`chore: archive issue 420 verification evidence`，20 路径证据归档）
- Owner requirements：派工明文 none；REST Issue comments = `[]`；简报 `## Comments` 空 ⇒ 无 owner 追加要求
- **Verdict：`approve`**（0 BLOCKER / 0 MAJOR；9 条非阻断 MINOR 见 §8——7 条前轮已登记项原样存续、1 条前轮 M3 闭合、2 条本轮新增登记；`requiresConflictRecheck: true`，理由见 §9）
- 审查范围声明：本报告只判断仓库与工程标准（AGENTS/ADR/模块责任/既有架构惯例/单一事实源/生命周期对称性/文件范围/测试质量标准）；Issue 需求是否完整实现属 SA10；rebase 后五门重取的形式闭合属 SA8 RA2（SA4/SA7 证据链）——本报告对二者只做状态登记与事实核验，不越权裁决。

---

## 1. Reviewed inputs（本轮读取/核验）

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420.md`（简报；AC1–AC5） | 读取 |
| `wiki/raw/task_issue-420_implementation_conflict_report.md`（SA8 iteration 8：**clear**；机械 rebase 路线终认；并集 blob `08fa49a1…` 钉死；RA1–RA6；窄域 `requiresConflictRecheck: true`） | 全文读取 |
| `wiki/raw/task_issue-420_sa3_impl.md`（iteration 2 节：20 路径暂存清单 × rebase 机械解备妥） | 读取 |
| `wiki/raw/task_issue-420_sa4_review.md`（iteration 1：approve；O8–O13） | 读取 |
| `artifacts/sa3-issue420-finalize-rebase-evidence.log`（SA3 iteration 2：§5–§7 dry-run rebase、§6 并集配方、§7b 归档重放、§8 dry-run 五门、§11 树绑定与 RA2 重取清单） | 全文读取关键节 |
| `artifacts/sa3-issue420-evidence-reconcile.log`（iteration 1 C1 归一化） | 头部/清单核验 |
| 前轮 SA9 报告（pre-rebase `a315e70` 轮，approve，7 MINOR） | 全文在册（HEAD `52a9e56` 携带）；本轮逐轴复核其结论在 rebased 树上的存续性 |
| SA6 契约 / SA1 设计 / SA2 / SA7 / SA8 三阶段报告 / relevant_decisions | 前轮已全文审；本轮按需复核引用面 |
| 规范面 | 根 `AGENTS.md`、`packages/ws-replication/AGENTS.md`（本轮 Host 提示重读）、ADR 0032（含澄清附录 A1/A2/A3，rebased 树 :32–51 在册） |
| 本轮独立 git 核验 | 见 §2/§3 全部命令级事实（父 OID、树 OID、blob hash、逐路径逐字节比对、DENY 面、whitespace 门、归档纯度、工作区净态） |

SA9 未修改任何生产代码、设计或测试；未运行测试/服务；唯一产物为本文件（原位覆盖前轮报告）。

## 2. Rebase 保真性核验（本轮核心新增面，全部独立重取，不采信自述）

### 2.1 谱系与授权消解的逐位落地

| 判据 | 期望（SA8 iteration 8 RA1） | 本轮实测 | 结论 |
| --- | --- | --- | --- |
| 重放交付父基 | `1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（全 OID） | `git log`：`9d2500d` 父 = `1f5809b001c984e63fac3bafd4c1f3febc76e8a8` 逐位相同 | ✅ |
| 唯一手工消解文件 | `packages/ws-replication/src/index.ts` | 树级比对（§2.2）其余路径非手工面 | ✅ |
| 并集 blob | `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1` | `git show 9d2500d:…/index.ts \| git hash-object --stdin` = `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1` **逐位相同** | ✅ |
| 反方位交错/改名/重排/顺手改动 | 禁用 | blob 逐位等于授权值 ⇒ 无任何偏离空间 | ✅ |
| 父 head 前移即停 | 前移须先复认 | 父 = 授权 OID 未前移 | ✅ |
| 交付本体（pre-rebase）零改动承诺 | — | `a315e70` 对象仍在册，仅作比对基；分支已重放 | 事实陈述 |

### 2.2 树级同一性：rebased 交付树 == SA3 dry-run 已跑门树

`git rev-parse 9d2500d^{tree}` = **`e777f96157b1dbf3908a62b323bf851b9da10e40`**，与 `finalize-rebase-evidence.log` §7 登记的 dry-run rebase 树 OID **逐位相同**（该节另以 scratch index 证明 dry-run 树 = merge-tree 自动合并结果 + 唯一冲突路径替换为并集 blob，零手工内容）。推论：

1. Controller 的 rebase 执行与 SA8 授权配方**逐字节一致**——配方钉死的树就是落地的树。
2. §8 的 dry-run 五门证据（V17 契约 3 路径 63/63 + typecheck 净、V18 包 tsc exit 0、V19 包套件 **87 files / 749 tests** exit 0、V20 根 typecheck 15 tsconfig exit 0、AC3 listen 矩阵 7 文件 52/52 exit 0）所作用的树与本交付树内容同一——**事实覆盖面成立**；但 SA8 §11/RA2 树绑定纪律明文 dry-run 不构成形式闭合，形式重取门仍挂 SA4/SA7 证据链（§8-M9 登记，非标准违例）。

### 2.3 交付路径逐字节矩阵（pre-rebase `a315e70` vs rebased `9d2500d`）

| 类别 | 路径 | 结论 |
| --- | --- | --- |
| 逐字节同一（9） | ADR 0032 附录、`hub-session-host.ts`（新公共工厂 263 行）、`hub-session.ts`（重命名）、`hub-split.ts`（仅头注）、`issue420-shim-hub.ts`（740 行夹具，sha256 `88029c40…` 两侧相同）、#418 structure 测试、#420 test-d、#420 round、#420 shim-matrix | 前轮 approve 的实质分析面**逐字节存续**，无需重审即成立 |
| 并集（3，auto-merge 干净） | `CONTEXT.md`、`hub-connection.ts`、#418 contract 测试 | 本轮逐面核验两侧内容俱在、零丢失（§2.4） |
| 并集（1，授权 blob） | `src/index.ts`（95 行） | §2.1 逐位等于 `08fa49a1…` |

### 2.4 三个 auto-merge 路径的并集内容抽查（本轮亲验）

- **`CONTEXT.md`**：#420 SessionHost 词条公共工厂轨形态（:229-231，`createHubSessionHost`/`open()` 描述子/句柄/`_Avoid_` 增「把公共描述子喂入 authorize/transport 面」）与 #421 edge 词条 `_Avoid_` 增「在宿主缝外自建连接级准入管线…」**同时在册**。
- **`hub-connection.ts`**：#420 机械重命名跟随（`import { createHubSessionSink }` :18、调用点 :344、头注 :6）与 #421 准入拆分内容（`hub-upgrade-admission` 引用在场）**同时在册**；旧工厂名 `createHubSessionHost` 在该文件零命中。
- **#418 contract 测试**：`FROZEN_PRODUCTION_EXPORTS` = 13 项，`createHubReplicationEdge` 与 `createHubSessionHost` 同列且字母序位正确，既有 11 名零删除零重排——与并集 `index.ts` 面逐名一致（SA8 §2-5 的 auto-merge 树内断言在真实树上复核成立）。

### 2.5 rebased 树上的 DENY 面 / 卫生门（本轮独立执行）

- `git diff --stat 1f5809b 9d2500d --` 对以下全部为空：`hub-namespace.ts`、`hub-edge.ts`、`hub-edge-host.ts`（#421 模块本体）、`hub-upgrade-admission.ts`、`src/testing.ts`、`frame-io/backpressure/round-engine/observer/types/validate/defaults/plugin`、`docs/protocols/**`、`packages/replication-protocol/**`、`packages/namespace-registry/**`、`apps/**`、`domains/**`、`packages/ws-replication/package.json`、7 个 listen 矩阵文件、`test/*issue421*`（7 文件）。
- 交付 commit 路径全集：13 个业务路径 + `wiki/raw/` + `artifacts/`，**零越界**（其余前缀计数 0）。
- `git diff --check 1f5809b 9d2500d` RC=0；`git diff --check 9d2500d 52a9e56` RC=0。
- 归档 commit 业务面纯度：`git diff --stat 9d2500d 52a9e56 -- packages apps domains docs tests scripts CONTEXT.md …` 全空 ⇒ 纯证据归档。
- 工作区 `git status` 全空（零未跟踪/零暂存）——前轮 M3 的「工作区遗留证据」已清零。

### 2.6 归档 commit 对 SA8 RA6 / 前轮 M3 的闭合

`52a9e56` 恰 20 路径 = 14 个 artifact 日志（mutation ×7、design-letter-divergence、red-contract、evidence-reconcile、finalize-rebase-evidence、sa6-runner-trigger-red、sa7-focused-420-tests、sa7-listen-matrix-baseline）+ 6 个 wiki 路径（任务简报、SA9、SA10、SA3/SA4 原位更新、SA8 活报告）——与 RA6 登记的 20 路径口径**逐一相同**；前轮 SA9 §10-M3 列举的未跟踪清单（13 条）全数入档。**前轮 M3 闭合。**

## 3. 标准符合性总账（rebased 树）

| 标准轴 | 结论 | 依据 |
| --- | --- | --- |
| 根 AGENTS + `packages/ws-replication/AGENTS.md` | ✅ 符合 | §4 |
| `docs/AGENTS.md`（显式修订/CONTEXT 同步/不复制规则/diff-check） | ✅ 符合 | §4.3 |
| ADR 0032 决策 1–5 + 澄清附录 + 关联 ADR/协议冻结面 | ✅ 符合 | §5 |
| 模块责任 | ✅ 符合 | §6.1 |
| 既有架构惯例 | ✅ 符合 | §6.2 |
| 单一事实源 | ✅ 符合 | §6.3 |
| 生命周期对称性 | ✅ 符合 | §6.4 |
| 文件范围（ALLOW/DENY/授权编辑/并集纪律） | ✅ 符合（本轮逐字节核验） | §2/§7 |
| 测试质量标准 | ✅ 符合 | §7.3 |

说明：9 个交付路径与前轮 approve 面**逐字节同一**（§2.3），前轮 SA9 §3–§9 的实质判定（AGENTS 逐项、ADR 决策逐条、模块责任、惯例、SoT、生命周期、测试质量）在 rebased 树上**不因其承载字节而变化**；本轮对全部「与父增量相交」的面（CONTEXT.md、hub-connection.ts、#418 contract 测试、index.ts）与全部流程面（rebase 配方、归档、卫生门）做了独立重取。

## 4. AGENTS 规约核验（rebased 树）

### 4.1 根 AGENTS.md

| 条款 | 核验 | 结论 |
| --- | --- | --- |
| Domain docs（root CONTEXT + docs/adr） | SessionHost 词条与 edge 词条并集俱在（§2.4）；ADR 0032 附录字节与前轮同一 | ✅ |
| Module guidance（改 `packages/` 前读嵌套 AGENTS） | 全流水线援引 `packages/ws-replication/AGENTS.md`；本轮 Host 提示重读并逐条对照 §4.2 | ✅ |
| Instance replication（ADR 0010 + 协议 v1 为规范） | 本交付零 wire/错误码/事件变化（协议文本零 diff）；分块面零触碰 | ✅ |
| Git worktrees（`.worktrees/`） | SA3 dry-run scratch worktree 落于 `.worktrees/sa3-420-*` 且用后移除（log §0/§12-R5 登记） | ✅ |

### 4.2 `packages/ws-replication/AGENTS.md`（本轮 Host 提示重读）

| 条款 | rebased 树核验 | 结论 |
| --- | --- | --- |
| 「Export production APIs through `src/index.ts`…」 | 并集 `index.ts`（95 行亲读）：值导出 13 = 基线 11 + `createHubSessionHost` + `createHubReplicationEdge`；类型面 = types.js 全集 + 8 edge + 7 session；零逻辑、零改名零删除；shim 夹具仍只落 `test/` | ✅ |
| 「Keep admission bounded…」 | 夹具 pending 界 ≤16 + `CONNECTION_POLICY_VIOLATION`(1008) 字节存续（:93-94/:503）；先例符号本体经 #421 迁至 `hub-upgrade-admission.ts:26`（值 16 不变——RA3 守约面） | ✅（头注指针滞后 → §8-M8） |
| 「Preserve protocol ordering and FSM invariants」 | `hub-namespace.ts` 对父零 diff（§2.5）；session 侧 `expectedSequence` 本轮 grep = **0**；出站占位 0 + edge mux 盖章单点不动 | ✅ |
| 「Route namespace ownership…through public Registry leases」 | 公共工厂只组装既有 splice，不接 Runtime/Persistence/Y.Doc（字节存续） | ✅ |
| 「Preserve shutdown safety…§21」 | `close()` 幂等单 promise 等对称面字节存续（前轮 §8 逐项） | ✅ |
| 「Bind Hub connections to the trusted identity…」 | `remoteInstanceId` = edge 认证后身份（夹具 `verifyToken` 结算面字节存续） | ✅ |
| 「Verification」：聚焦 + 包 typecheck + 根 typecheck/test | dry-run 五门绿于**与本交付逐字节同一的树**（§2.2）；RA2 形式重取门挂 SA4/SA7（§8-M9）；pre-rebase 全量根 443/5381 证据在册 | ✅（形式闭环见 M9） |

### 4.3 `docs/AGENTS.md`

显式修订（附录 + 词条而非静默改文）、CONTEXT 同步（词条并集俱在）、不复制规则（援引 ADR/源码锚）、`git diff --check`（两 commit 均 RC=0）——全部符合。

## 5. ADR / 协议符合性（rebased 树）

- **决策 1（FSM 单份/沿内缝拆分）**：`hub-namespace.ts`/`hub-edge.ts` 对父零 diff；公共工厂复用 `createHubSessionSink` 单份组装——字节存续。✅
- **决策 2（缝只过 Uint8Array/纯 JSON、零 worker）**：本轮 grep `worker_threads|MessageChannel|MessagePort` 于 `src/**`+`package.json` = **0**；test-d/夹具字节存续。✅
- **决策 3（authorize 在 edge、投影传递）**：描述子/闭包回放面字节存续；test-d 负控字节存续。✅
- **决策 4（路由键契约）**：#419 守卫零触碰（DENY 空）。✅
- **决策 5（dormant 降级/事件 append-only）**：adapterPort 面字节存续；并集未新增任何事件型。✅
- **后果节（公开面 append-only 冻结）**：并集 = 两侧 append-only 追加的字面机械应用；冻结表 13 项与导出 13 名逐名一致（§2.4）；rebase 未引入任何重排/删除/改名（授权 blob 逐位钉死）。✅
- **附录 A1/A2/A3**：附录文本字节与前轮同一（前轮逐句与实现比对一致）；实现面字节存续 ⇒ 一致性存续。✅
- **关联面（ADR 0010/0012、协议 §4/§7.1/§13/§14/§17/§19/§23.1）**：零触碰（§2.5）。✅

## 6. 模块责任 / 架构惯例 / 单一事实源 / 生命周期

### 6.1 模块责任
生产侧新增面仍只有 `hub-session-host.ts`；一切协议判定仍由零 diff 通道产出；桥只落 `test/` 且字节存续；#421 新模块（`hub-edge-host.ts`/`hub-upgrade-admission.ts`）属父增量、非本交付触碰面（§2.5）。✅

### 6.2 既有架构惯例
工厂命名/配置注入惯例、内部重命名让出公共名（`createHubSessionSink`/`HubSessionSinkConfig` 面字节存续）、测试族命名布局、有界窗口先例（值 16 不动）、commit 信息风格、wiki/artifacts 入档先例（#418/#419/#421 同口径——本轮 M3 闭合后证据集完整）——全部符合。`hub-split.ts` 头注「三工厂现状」陈述字节存续，与 rebased 树三工厂现实一致。✅

### 6.3 单一事实源
协议 FSM 单份、wire 序单点（edge mux）、codec 单份、observer 分发/时钟折叠单点、admission 台账单点、错误码映射单点——以上权威源全部零 diff 或字节存续；并集未复制任何规则成第二份文本。✅

### 6.4 生命周期对称性
open/close/terminate/onFrame/onSignal/pending/terminateWaiters/桥 close 的对称释放与响亮失败路径全部字节存续（前轮 §8 逐行判定）；rebase 未触碰任何生命周期代码。✅

## 7. 文件范围与测试质量

### 7.1 ALLOW
rebased 交付的 13 个业务路径 = 前轮 ALLOW 清单逐名同一（§2/§2.5 核验）；授权编辑两处（contract 测试并集插入 + structure 测试机械跟随）在 rebased 树上形态正确（§2.4）。

### 7.2 DENY
§2.5 全空；协议文本零 diff；7 listen 矩阵与 7 个 #421 测试文件零 diff。

### 7.3 测试质量标准
零 skip/only/todo（本轮 grep 三新文件 + 夹具 = 0）；session 侧零 `expectedSequence`（本轮 grep = 0）；零 worker 依赖/类型（本轮 grep = 0）；test-d 双面发现与 6 负控字节存续；红/绿证据链与变异敏感性证据随 RA6 全量入档（M3 闭合）；dry-run 五门绿于逐字节同一的树（§2.2）。✅

## 8. 非阻断 MINOR 观察（不阻断 approve）

| # | 观察 | 现状/处置 | 来源 |
| --- | --- | --- | --- |
| M1 | 设计 wiki §7 D7 `namespaceFrame` 行字面滞后于载体提交机制 | SA8 RA1'' 登记 wiki 内务（三重登记在场）；沿用前轮 | 前轮 M1 |
| M2 | ADR 0032 附录 A2 β「按准入结局」措辞未覆盖「按帧到达形态」第三判据 | SA8 行 11 已裁非冲突；措辞对齐随 RA1'' 落 | 前轮 M2 |
| ~~M3~~ | ~~证据集未完整入档~~ | **本轮闭合**：`52a9e56` 恰 20 路径（RA6 口径逐一相同），工作区净 | 前轮 M3 → closed |
| M4 | SA6 三个诊断探针 `.mts` import 旧名 `createHubSessionHost`（重跑前需改 `createHubSessionSink`） | 转交 SA6/Controller；探针不在任何 gate include 面 | 前轮 M4 |
| M5 | 夹具探针 `handles` 以 namespaceId 为键（多连接同 ns 覆盖） | SA4 O3 登记：多连接断言使用前改复合键 | 前轮 M5 |
| M6 | 公共 host `sessions` Map 无删除路径 | 冻结语义字面兑现；后续宿主接线票定生命周期约定 | 前轮 M6 |
| M7 | M1-a12 变异日志缺命令行回显 | SA4 O7 登记证据卫生 | 前轮 M7 |
| M8（新） | RA3 卫生项在 rebased 交付中仍未落：夹具头注 :93「镜像 `hub-connection.ts` 的 `MAX_EARLY_FRAMES` 先例」的指向未随 #421 拆分改指 `hub-upgrade-admission.ts`（符号本体 :26，值 16 未动——守约面完好；夹具字节 = 前轮授权字节，rebase 未也不得顺手改） | SA8 RA3 明文**非门禁**；登记留待后续卫生票 | 本轮核验 |
| M9（新） | RA2 形式闭环未落树：post-rebase 五门重取的 SA4/SA7 证据日志尚未入档（本轮 grep `9d2500d`/`52a9e56` 于 wiki/raw+artifacts 零命中）；dry-run 五门绿于与本交付逐字节同一的树（§2.2），事实覆盖成立、形式闭合挂起——SA8 §11 树绑定纪律明文 dry-run 不闭合 RA2 | 属 SA8 RA2/SA4/SA7 流程门（阻断交付合并，非本交付标准违例）；本报告 `requiresConflictRecheck: true` 与此联动（§9） | 本轮核验 |

## 9. 结论

**`approve`**。rebased 最终交付在全部标准轴上符合仓库与工程标准：

1. **Rebase 保真性**：父基逐位 = 授权 OID；唯一冲突文件 `src/index.ts` 逐位 = SA8 授权并集 blob `08fa49a1…`；交付树 OID `e777f961…` 与 SA3 dry-run 已跑门树逐位同一 ⇒ 配方零偏离、零手工内容、零顺手改动（RA1 全要素成立）。
2. **实质面存续**：9/13 交付路径与前轮 approve 面逐字节同一；3 个 auto-merge 路径并集内容两侧俱在零丢失；1 个并集路径即授权 blob。前轮 §3–§9 的 AGENTS/ADR/模块责任/惯例/SoT/生命周期/测试质量判定在 rebased 树上全部存续，本轮对相交面与流程面独立重取一致。
3. **冻结面与范围**：DENY 面（含 #421 新增模块本体、7 listen 矩阵、7 个 #421 测试、协议文本）对父零 diff；交付 commit 零越界；归档 commit 纯证据；两 commit `git diff --check` 均净；公开面 append-only（13 值导出与冻结表逐名一致）。
4. **流程面**：前轮 M3（证据归档）由 `52a9e56` 按 RA6 口径闭合；RA3 卫生项与 RA2 形式闭环登记为 M8/M9（均非门禁、均非本交付代码正确性或标准符合性问题）。

**requiresConflictRecheck: true**——依据：SA8 iteration 8 武装的窄域 recheck 触发条件（「公共 API 并集面在 rebase 后真实树上落地并核对」）已由本轮核验**事实成立**（并集 blob 落树 + 冻结表 13 项逐名一致），但其形式闭合（及 RA2 五门在真实树的 SA4/SA7 证据重取）按 SA8 §8/§10 归属 Controller/SA4/SA7/SA8 后续轮次，尚无人落盘。本标志驱动该形式闭环的调度，不表示本轮发现新的决策冲突面（本轮裁决面：0 hard-conflict、0 evolution-required）。
