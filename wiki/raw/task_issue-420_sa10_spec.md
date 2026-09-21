# SA10 Spec 审查报告 — Issue #420（SessionHost 公共工厂 + 内存管道完整协议回合，spec #415 T3）

> SA10（独立 Spec 审查者）spec-review 轮产物。dispatch `sa-d747b466-3eb9-46b1-b35d-5bfaba6c6a5b`，
> role `mabf-sa10`，phase spec-review，iteration 0。
> **被审对象**：**rebase 后的最终交付** —— 交付 commit `9d2500dd84f59c0bfaa94c53eb1e9966cec82b42`
> （`feat(ws-replication): expose session host factory`，父 = 权威父基 `1f5809b001c984e63fac3bafd4c1f3febc76e8a8`
> = Parent PR #416 head / PR #427 merge，本轮 `git cat-file commit` 亲证父链与 tree）+ 证据归档 commit
> `52a9e56534d56a75127207b2b9044afa8c3a27b0`（`chore: archive issue 420 verification evidence`，
> 当前 HEAD，本轮 `git rev-parse HEAD` 亲证一致；branch `mabf/issue-420`，工作树干净）。
> **Issue 评论输入**：派工明示 Owner feedback requirements = none；REST Issue comments = `[]`
> （任务简报 `wiki/raw/task_issue-420.md` Comments 节为空）⇒ 无逐条 Owner 评论映射面。
> **前轮账（不堆叠为当前结论）**：iteration-0 SA10（dispatch `sa-d91f8fb1…`）对 rebase 前交付
> `a315e70`（父 `7039f6d`）判 **approve**；本轮对象 = 同一交付经 SA8 授权的机械并集解 rebase 到
> 权威父基后的最终形态。
> **输入产物（全部亲读）**：Issue #420 正文（AC1–AC5、Blocked by #418）、`task_issue-420_sa6_contract.md`
> （冻结验收契约 §12.1–§12.7）、`task_issue-420_design.md`（iteration 1，D1–D10 + ALLOW/DENY）、
> `task_issue-420_sa2_review.md`（approve，SA2-F1 已解决）、`task_issue-420_sa3_impl.md`
> （V1–V21 + Deviations 1–4 + iteration 1/2 节）、`task_issue-420_sa4_review.md`（approve ×2 轮）、
> `task_issue-420_sa7_report.md`（approve）、`task_issue-420_sa9_standards.md`（approve）、
> `task_issue-420_conflict_report.md` / `_design_conflict_report.md` /
> `_implementation_conflict_report.md`（SA8 三段 clear；末段第八轮 = 权威父基 + 机械 rebase 路线终认，
> `requiresConflictRecheck: true` 窄域）、`task_issue-420_relevant_decisions.md`、
> `artifacts/sa3-issue420-finalize-rebase-evidence.log`（§5–§9 rebase 配方与干跑门原文）。
> **独立核验方式（本轮全部亲读/亲跑只读命令，非转述）**：rebase 保真度五项独立重取（§0）；
> 并集完备性逐行核对（交付侧/父侧新增行缺失数均 = 0）；`src/index.ts` 并集 blob 哈希亲算；
> AC4/AC5 结构门与 DENY 面在 **rebase 后真实树**上本轮重跑；`git diff --check` 两 commit 各跑一次；
> 证据归档 20 路径与 SA8 RA6 清单逐条比对。
> **边界**：零代码/设计/测试/文档改动；未运行测试、未启动服务；零 commit/push/PR；唯一写入 = 本文件。

---

## Verdict

**approve**（`requiresConflictRecheck: true` —— 窄域，非本轮新发现：SA8 第八轮已武装的 recheck
在 RA2 五门于真实树重取并入档后形式闭合，见 §7-9；本轮未发现新的决策冲突面）。

**核心理由**：

1. **Rebase 机械保真度全项独立复核成立（§0）**：唯一冲突路径 `packages/ws-replication/src/index.ts`
   的解 = SA8 钉死的并集 blob `08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`（本轮亲算逐位相同）；
   9 条 #420 独有 ALLOW 路径 rebase 前后逐字节相同；4 条 both-modified 路径（`CONTEXT.md` /
   `hub-connection.ts` / #418 contract 测试 / `index.ts`）两侧新增行零丢失、基线行零删除零改写
   （`index.ts` base→union 纯增 4 hunk、0 删除行）；真实交付树 tree OID `e777f961…` 与 SA3 干跑
   rebase 树逐位相同（= merge-tree 自动合并结果 + 唯一冲突路径并集 blob，冲突路径之外零手写内容）。
2. **五条 AC 在 rebase 后树上逐项复核仍满足（§1–§5）**：#420 全部验收载体（新生产模块、夹具、
   三个新测试文件、两处授权编辑、ADR 附录、CONTEXT 词条）逐字节保留；AC4/AC5 结构门与 DENY
   零 diff 在含 #421 增量的新基上本轮重跑结果不变（0 命中 / 空 diff）。
3. **规范面零违约保持（§6）**：ADR 0032 决策 1–5 与澄清附录、协议 v1 冻结面、CONTEXT 词条、
   append-only 后果节在并集下全部保持；导出并集 13 值名与 #418 冻结表 13 项逐名一致。
4. **无 scope creep**：rebased 交付 commit 相对父基 `1f5809b` 的改动面 = 恰 13 条设计 ALLOW
   路径（本轮 `git diff --name-only` 亲证）；证据归档 commit 零业务路径。
5. 残余事项全部为在册登记项/流程门（§7），无关键 AC partial/unmet/unachievable。

---

## 0. Rebase 保真度独立核验（本轮核心新增工作）

| # | 核验点 | 本轮独立取证（命令与观察） | 判定 |
| --- | --- | --- | --- |
| R1 | 权威父基与父链 | `git cat-file commit 9d2500d`：parent = `1f5809b001c984e63fac3bafd4c1f3febc76e8a8`（= 派工指定的 authoritative Parent #416 head）；`52a9e56` 父 = `9d2500d`；工作树干净、`.worktrees/` 空 | ✅ |
| R2 | 并集 blob 逐位相同 | `git cat-file blob 9d2500d:packages/ws-replication/src/index.ts \| git hash-object --stdin` = **`08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`** —— 与 SA8 第八轮 §2-4 钉死值、SA3 证据日志 §6 登记值逐位相同；反方位交错 `2e23e39e…` 未出现 | ✅ |
| R3 | #420 独有路径零漂移 | 9 条（`src/hub-session-host.ts`、`src/hub-session.ts`、`src/hub-split.ts`、`test/issue420-shim-hub.ts`、`test/…issue420-session-host-api.test-d.ts`、`test/…issue420-session-host-round.test.ts`、`test/…issue420-shim-matrix.test.ts`、`docs/adr/0032-….md`、#418 structure 测试）`a315e70` blob == `9d2500d` blob，**9/9 IDENTICAL**（本轮逐条 `hash-object` 比对） | ✅ |
| R4 | both-modified 并集完备 | 4 条（`CONTEXT.md`、`src/hub-connection.ts`、#418 contract 测试、`src/index.ts`）：对每条分别取交付侧（`7039f6d..a315e70`）与父侧（`7039f6d..1f5809b`）新增行全集，逐行 `grep -F` 核对在 rebase 后文件中在场——**交付侧缺失 0 / 父侧缺失 0 × 4 条** | ✅ |
| R5 | 基线行零删除零改写 | `git diff 7039f6d 9d2500d -- src/index.ts` 删除行计数 = **0**；纯增 hunk = 交付工厂导出 +1、父侧注释+工厂导出 +3、父侧类型块、交付类型块（相邻空行并一 = 空白级合并）；`hub-connection.ts` 并集同时含 #420 重命名（`createHubSessionSink` import :18 / 调用 :344 / 头注 :6）与 #421 抽取（`installEarlyFrameAdmission` import :36 / 调用 :163/:248） | ✅ |
| R6 | 真实树 = 干跑树 | `9d2500d` tree = **`e777f96157b1dbf3908a62b323bf851b9da10e40`**，与 SA3 干跑 rebase 树 OID 逐位相同（证据日志 §7：干跑树 = merge-tree `a24156e2…` + 唯一冲突路径并集 blob，`IDENTITY=YES`）⇒ 干跑门证据（§8：V17 63/63、V18 tsc 0、V19 **87 files/749 tests**、V20 根 typecheck 0、AC3 listen 7/52 全绿）与真实树内容逐字节同内容 | ✅ |
| R7 | 改动面 = ALLOW 13 条 | `git diff --name-only 1f5809b 9d2500d`（剔 `artifacts/`/`wiki/`）= 恰 13 条设计 §11 ALLOW 路径；`git diff --check 1f5809b 9d2500d` RC=0 | ✅ |
| R8 | 证据归档 = RA6 20 路径 | `git diff --name-only 9d2500d 52a9e56` = **20 条**（14 条 artifact 日志 + 简报 + SA8 impl 报告 + SA3/SA4/SA9/SA10 产物），与 SA3 iteration-2 staging 清单、SA8 RA6 清单逐条一致；业务面 diff 空（`-- packages docs CONTEXT.md .editorconfig vitest.config.ts package.json tsconfig*` 空）；`git diff --check` RC=0 | ✅ |
| R9 | 无 RA4 触发 | 未偏离并集 blob（R2）；未触缝类型/wire（§6）；未出现两工厂直接组合面立项；父 head 未前移（R1） | ✅ |

## 1. AC1 — SessionHost 工厂从包公共入口导出，签名经 test-d 锁定（SA6 冻结纪律）：**满足（rebase 后复核）**

| 核验点 | 本轮独立取证（rebase 后真实树） | 判定 |
| --- | --- | --- |
| 公共入口导出 | `src/index.ts` 并集面：13 值导出 = 基线 11 + `createHubSessionHost`（:6，自 `./hub-session-host.js`）+ `createHubReplicationEdge`（:10，#421 自 `./hub-edge-host.js`）；基线 11 名零删除零改写（§0-R5）；两工厂各自独立模块来源，无组合面 | ✅ |
| 冻结签名逐字 | `src/hub-session-host.ts` 与 rebase 前批准版**逐字节相同**（§0-R3）⇒ SA6 §12.1 冻结声明（config 7 成员 / 描述子 6 字段 / `authorization: Extract<NamespaceAuthorization,{ok:true}>` / lane 联合 / listener `(Uint8Array,lane)=>number` / 信号两态 / 句柄 5 方法 / `open` 同步返回）在 rebase 后逐字保持 | ✅ |
| test-d 锁定 | `…issue420-session-host-api.test-d.ts` 逐字节相同（§0-R3）：正控全集 + 6 项 `@ts-expect-error` 负控（denied 投影 / authorize / transport / port / `namespaceFrame` / `onFrame` 无 number）；#421 的 edge 工厂 test-d（父侧携带）与本文件并存于同一 typecheck 面（干跑 V17/V19 含 `--typecheck` 全绿，树同内容，§0-R6） | ✅ |
| 运行时导出面恰增 | #418 contract 测试 `FROZEN_PRODUCTION_EXPORTS`（rebase 后树 :145-158）= **13 名**（基线 11 + `createHubReplicationEdge` + `createHubSessionHost`，字母序，零删除零重排），与并集导出面逐名一致；`:552` 全等断言形态不变 | ✅ |

## 2. AC2 — 内存管道对驱动 OPEN→bootstrap→live update→reconcile→CLOSE 完整回合：**满足（rebase 后复核）**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 验收载体完整 | 回合测试（A1–A12 + C4a–d + C5a–c）与夹具 `issue420-shim-hub.ts`（三分支路由 + 有界 pending + 载体提交 + E10 兜底 + closed 守卫）逐字节保留（§0-R3） | ✅ |
| 装配依赖面在并集下不变 | 夹具 import 面本轮亲读：仅深路径（`../src/hub-edge.js`、`../src/hub-session-host.js`、`../src/hub-session.js`、`../src/hub-split.js`、`../src/defaults.js`、`../src/validate.js`、`../src/types.js` + 上游包），**不 import 包入口**（mock 安全保持）；`hub-edge.ts` 在父增量中零变化（父 diff 不含该文件）⇒ 夹具消费的全部模块在 rebase 后逐字节同前 | ✅ |
| 无 socket 无 worker | `makeWire()` 内存双端装配不变；§4 结构门本轮重跑 0 命中 | ✅ |
| 回合动态证据 | rebase 前：SA3 V3/V15（63/63 含 A12 红臂）、SA7 聚焦 63/63 + 三探针 61/61（3× 一致）；rebase 后同内容树：SA3 干跑 V17（3 files/63 tests/Type Errors 0/exit 0，§0-R6）；真实树 RA2 形式重取 = §7-9 登记项 | ✅ |

## 3. AC3 — 现有 hub-namespace 测试矩阵在 shim 上重跑绿灯（通道零改动 + 状态机零 fork）：**满足（rebase 后复核）**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 矩阵文件零编辑 | 7 矩阵文件不在交付 diff（§0-R7）也不在父增量（`7039f6d..1f5809b` 13 路径不含）⇒ rebase 后与基线逐字节相同 | ✅ |
| shim 机制 (a) 完整 | `…issue420-shim-matrix.test.ts` 逐字节保留（§0-R3）：`vi.mock` 仅替换 `createHubReplication` + 动态 import 7 文件 + 末位反空跑 + unhandled 哨兵；mock 目标 = 包入口别名，并集后别名指向不变（`vitest.config.ts` 零 diff） | ✅ |
| 通道零改动 | `git diff --stat 1f5809b 9d2500d -- hub-namespace.ts hub-edge.ts src/testing.ts package.json 协议文本` = **空**（本轮亲跑）；父增量对 `hub-namespace.ts`/`hub-edge.ts` 亦零变化 | ✅ |
| 状态机零 fork | 夹具逐字节同前（仍零应答合成/零错误码选择/零 FSM）；协议 FSM 唯一在零 diff `hub-namespace.ts` | ✅ |
| 重跑计数自洽 | rebase 后同内容树干跑：V19 包全量 **87 files / 749 tests**（= 80 既有含 shim 臂 53 + 7 个 #421 新文件 98 用例）+ AC3 listen 矩阵 7/52 全绿（§0-R6）；M4 反空跑负控证据（rebase 前 `sa3-issue420-mutation-M4-disable-shim.log`）随归档 commit 入库 | ✅ |
| SA2-F1 再 OPEN 覆盖 | 矩阵 `:212`/`:240` 两用例 shim 臂断言载体逐字节保留；M7/M7b 变异日志随归档入库 | ✅ |

## 4. AC4 — 缝两侧只过 Uint8Array 与纯 JSON；包内零 worker 依赖/类型：**满足（rebase 后本轮重跑）**

| 判据 | 本轮独立取证（rebase 后真实树） | 判定 |
| --- | --- | --- |
| C4a 结构门 | **本轮重跑** `grep -rnE 'worker_threads\|MessageChannel\|MessagePort' packages/ws-replication/src packages/ws-replication/package.json` = **0 命中**（exit 1）——含 #421 新增 `hub-edge-host.ts`/`hub-upgrade-admission.ts` 在内的新基全量；`package.json` 零 diff | ✅ |
| C4b/C4c/C4d | 承载断言的回合测试逐字节保留（§0-R3） | ✅ |

## 5. AC5 — session 侧重检入站 sequence 的代码不存在：**满足（rebase 后本轮重跑）**

| 判据 | 本轮独立取证（rebase 后真实树） | 判定 |
| --- | --- | --- |
| C5c 结构门 | **本轮重跑** `grep -c expectedSequence src/hub-session-host.ts` = **0**（文件本身亦逐字节同前） | ✅ |
| C5a/C5b 行为锚 | 承载用例逐字节保留（§0-R3）；M5 变异红证据随归档入库 | ✅ |

## 6. 规范一致性、非目标与 scope 核验（rebase 后）

| 面 | 核验（本轮） | 判定 |
| --- | --- | --- |
| ADR 0032 决策 1（FSM 单份、分布式实例化） | `hub-namespace.ts` 零 diff（§3）；公共工厂内部复用 splice 的实现文件逐字节同前 | ✅ |
| ADR 0032 决策 2（字节/纯 JSON 缝、序纪律、信号面） | §4/§5 本轮重跑；出站占位 + edge mux 盖章面零触碰 | ✅ |
| ADR 0032 决策 3（authorize 在 edge、投影传递） | 实现逐字节同前；附录 A2 β 文本在 ADR 0032 中逐字节保留（§0-R3） | ✅ |
| ADR 0032 决策 4/5（路由键、dormant 降级、observer 发射点） | 相关 DENY 面零 diff；adapterPort 实现逐字节同前 | ✅ |
| ADR 0032 后果节 append-only | 并集 = 两侧 append-only 追加的机械并（§0-R5）；#418 冻结表 13 名逐名一致（§1） | ✅ |
| 澄清附录/CONTEXT 词条（E1/E2 闭合义务） | ADR 0032 附录逐字节保留；CONTEXT.md「SessionHost」词条（:230 公共工厂轨句）与「复制 Edge」词条 #421 增补在并集中同时在场（本轮亲读） | ✅ |
| 协议 v1 冻结面 | `docs/protocols/instance-replication-v1.md` 零 diff（§3）；父增量对 `docs/adr/**`/`docs/protocols/**` 零变化（SA8 §2-1 同口径） | ✅ |
| 非目标边界（无 scope creep） | 未触 peer 侧拆分、真 worker 传输、服务轨、跨进程 revoke、wire 格式；交付 commit 改动面恰 13 ALLOW 条（§0-R7）；证据 commit 零业务路径（§0-R8） | ✅ |
| #421 并集共生面 | #421 公共 edge 工厂（`hub-edge-host.ts`）与 #420 公共 session 工厂同名不同模块的内部符号无冲突（夹具深路径 import 消歧，§2）；#421 把 `MAX_EARLY_FRAMES` 逐字搬迁至 `hub-upgrade-admission.ts:26`（值 16 不变）——夹具本地常量与镜像语义不受影响（仅头注指针陈旧，§7-8） | ✅ |

## 7. PR 必须披露的未达成/登记项（均不阻断 approve）

1. **设计文本滞后一行（SA8 RA1''，wiki 内务，Controller/SA1 持有）**：实现「载体提交」机制
   （夹具 routing 相位非 OPEN 帧即时提交生产 splice 承载）偏离设计 §7 D7 `namespaceFrame` 行字面；
   SA8 已裁 implements-existing-decision，SA7 A/B 探针证逐字节等价（19/19，3×）；待办 = 设计 D7 行
   文本补正 + 附录 A2 β 措辞对齐。rebase 不改变本项状态。
2. **反空跑锚替换（SA3 Deviation 3 / SA8 行 22，no-conflict）**：末位反空跑锚 = `settled≥1` +
   零 `INTERNAL_ERROR` + 计数阈值（`ACK_STATE_VIOLATION` 锚经核为 peer 侧 fatal）；M4 变异证非恒真。
   验收语义未弱化。
3. **U2 真 worker 形态未解（明示非目标）**：本票只冻结同步宿主 pipe 面；异步序回传与跨线程
   pending 义务留后续票并按 R4''/R5'' 重新过 SA8。PR 不得声称已解决真 worker 形态。
4. **服务轨/宿主接线为后续票**：`listen:false` 插件 + `nomicoreHubSessionHost` 服务、peer 侧拆分、
   nomic-server 宿主接线、跨进程 revoke 全链路 = 明示非目标。
5. **观测边界登记（R6/R7/R11/R12）**：`selectedCapabilities` 单 bit 反推；shim 下 authorized 通道
   不投影 `edge.channels`；在途路由期 revoke 的 wire 时序观测边界；桥 accept 门链保真度差异清单——
   全部在夹具头注/设计 §13 登记，防误当规范宿主样例。
6. **公共 host `sessions` 表无删除路径（SA4 O4）**：冻结语义「session 对象随连接存活」的字面兑现；
   未来跨连接复用单一 host 的宿主须先明确生命周期约定（服务轨票）。
7. **SA6 三个诊断探针陈旧名（SA8 RA4''）**：`artifacts/sa6-issue420-{capability-gap,causality,
   sequence-discipline}-probe.mts` 仍 import 重命名前旧名；不在任何 gate include 面，零 gate 影响。
8. **夹具头注指针陈旧（SA8 RA3，非门禁卫生项；rebase 后现实化）**：`test/issue420-shim-hub.ts:93`
   头注「镜像 `hub-connection.ts` 的 `MAX_EARLY_FRAMES` 先例」——#421 已把该常量逐字搬迁至
   `hub-upgrade-admission.ts:26`（值 16 不变，本轮亲证）。注释级指针更新归交付执行者，常数值不得动。
9. **SA8 RA2 五门真实树重取未落档（流程门，非 spec 缺陷）**：SA8 第八轮 `requiresConflictRecheck:
   true`（窄域）在册——并集公共 API 面与五门须在 rebase 后真实树落地核对。本轮亲证：真实交付树
   tree OID `e777f961…` 与 SA3 干跑门树**逐位相同**（§0-R6），干跑五门（V17 63/63、V18 tsc 0、
   V19 87/749、V20 根 typecheck 0、AC3 listen 7/52）在该逐字节同内容树上全绿；但按 SA8 树绑定
   纪律干跑证据不形式闭合 RA2——Controller 须在真实树重取五门并入档后由 SA8 形式核对闭合。
   本项不削弱任何 AC 的满足判定（交付内容逐字节 = 已批准内容 + 授权并集），仅为合并前流程门。
10. **证据打包（已闭合）**：iteration-0 SA10 §7-8 登记的未跟踪证据日志（变异 ×7、red-contract、
    sa6-runner、sa7 两日志等）已随 `52a9e56` 全量入库（§0-R8，20/20 路径）。

## 8. 结论

Rebase 后最终交付对 Issue #420 的五条 AC **全部满足且无部分实现**：全部验收载体逐字节保留、
并集解与 SA8 授权 blob 逐位相同、两侧内容零丢失、结构门在新基上本轮重跑结果不变；冻结契约与
规范面零违约保持；无 scope creep。残余项全部为在册登记项与合并前流程门（§7），其中 §7-9 的
RA2 真实树重取为 Controller/SA8 持有的形式闭合门。**approve**。
`requiresConflictRecheck: true`（窄域承接 SA8 第八轮武装态：RA2 五门真实树证据落档后形式闭合；
本轮未发现新的决策冲突面）。

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-420_sa10_spec.md
```
