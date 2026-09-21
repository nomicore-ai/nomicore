# SA10 Spec 审查报告 — Issue #420（SessionHost 公共工厂 + 内存管道完整协议回合，spec #415 T3）

> SA10（独立 Spec 审查者）spec-review 轮产物。dispatch `sa-102d5af8-c230-460b-bc45-05e64757128a`，
> role `mabf-sa10`，phase spec-review，iteration 1。
> **被审对象**：**第二段 rebase 后的最终交付谱系** —— 交付 commit
> `4e5ff0ab20d610aec14ecef85b6615590a0386e5`（`feat(ws-replication): expose session host factory`，
> 父 = 派工指定的权威父基 `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df` = Parent PR #416 head /
> PR #428（issue #423）merge，本轮 `git cat-file commit` 亲证父链与 tree）+ 证据归档 commit
> `eb5ec096742762b9b1b5e6d9c037e163c1b21174`（20 路径，52a9e56 内容的重放）+ 追加归档 commit
> `aff4bc0bceb15e6b1cc7638e73a68fd58138606b`（5 路径，当前 HEAD，本轮 `git rev-parse HEAD` 亲证一致；
> branch `mabf/issue-420`，工作树零 diff 亲证）。
> **Issue 评论输入**：派工明示 Owner requirements = none；REST Issue comments = `[]`（任务简报
> `wiki/raw/task_issue-420.md` Comments 节为空，SA8 iteration 5 本轮 `gh api` 亲验 comments=0）
> ⇒ 无逐条 Owner 评论映射面。
> **前轮账（不堆叠为当前结论）**：iteration-0 SA10（dispatch `sa-d91f8fb1…`）对 rebase 前交付
> `a315e70`（父 `7039f6d`）判 approve；前轮 SA10（dispatch `sa-d747b466…`）对第一段 rebase 交付
> `9d2500d`（父 `1f5809b`）判 approve + recheck；本轮对象 = 同一交付经 SA8 iteration 5 授权的
> **第二段机械 rebase**（`git rebase --onto 25c51cd 1f5809b`，重放恰 `9d2500d`+`52a9e56` 两 commit）
> 落到新权威父基后的最终形态。父基在 prior final review 后前移（`1f5809b` → `25c51cd`，
> 父增量 = issue #423 observer emission split）。
> **输入产物（全部亲读）**：Issue #420 正文（AC1–AC5、Blocked by #418）、`task_issue-420_sa6_contract.md`
> （冻结验收契约 §12.1–§12.7）、`task_issue-420_design.md`（iteration 1，D1–D10 + ALLOW/DENY）、
> `task_issue-420_sa2_review.md`、`task_issue-420_sa3_impl.md`（含 iteration 3：rebase 前工作树准备）、
> `task_issue-420_sa4_review.md`、`task_issue-420_sa7_report.md`、`task_issue-420_sa9_standards.md`、
> `task_issue-420_conflict_report.md` / `_design_conflict_report.md` /
> `_implementation_conflict_report.md`（SA8 三段 clear；末段 iteration 5 = 新权威基 `25c51cd`
> 二段路线终认，零冲突预演树 `7b5c1cbc…`/`2cee6d03…`，`requiresConflictRecheck: true` 窄域，
> RA1'–RA6'）、`task_issue-420_relevant_decisions.md`、
> `artifacts/sa3-issue420-rebase-prep-25c51cd.log`（SA3 iteration 3 零冲突复认 + 移交配方）、
> `artifacts/sa3-issue420-finalize-rebase-evidence.log`（第一段 rebase 证据）。
> **独立核验方式（本轮全部亲读/亲跑只读命令，非转述）**：rebase 保真度八项独立重取（§0，
> 含真实树 OID 对 SA8/SA3 双方独立预演树的逐位比对）；3 条重叠文件并集完备性逐行核对；
> AC1/AC4/AC5 结构门在 **rebase 后真实树**上本轮重跑；#420×#423 缝签名交互亲读核对；
> `git diff --check` 两 commit 各跑一次；归档路径 × 父增量路径交集核对。
> **边界**：零代码/设计/测试/文档改动；未运行测试、未启动服务；零 commit/push/PR/finalize；
> 唯一写入 = 本文件（原位替换前轮回产物，前轮文本已随 `aff4bc0` 入档于 git 历史）。

---

## Verdict

**approve**（`requiresConflictRecheck: true` —— 窄域，非本轮新发现：承接 SA8 iteration 5 武装态，
RA2' 五门在 `25c51cd` 基树重取并入档后由 SA8 形式核对闭合，见 §7-1；本轮未发现新的决策冲突面）。

**核心理由**：

1. **第二段 rebase 机械保真度全项独立复核成立（§0）**：真实交付树 tree OID `7b5c1cbc…` 与 SA8
   iteration 5、SA3 iteration 3 双方**独立**计算的零冲突 merge-tree 预演树逐位相同 ⇒ 纯机械重放、
   零手工消解（含 3 条重叠文件在内全树无一字节手写）；首个归档 commit `eb5ec09` 树 `2cee6d03…`
   同样与预演全 tip 树逐位相同；`index.ts` 并集 blob `08fa49a1…` 原样过继（本轮 rev-parse 亲证）；
   10/10 非重叠路径与前轮已批准交付 `9d2500d` 逐字节相同；3 条重叠文件（ADR 0032 / `hub-session.ts` /
   `hub-split.ts`）两侧新增行零丢失、删除行 = 精确并集（0/0、10+3=13、2+2=4）。
2. **五条 AC 在 rebase 后树上逐项复核仍满足（§1–§5）**：#420 全部验收载体（新生产模块、夹具、
   三个新测试文件、两处授权编辑、ADR 附录、CONTEXT 词条）逐字节保留；AC1 导出面/冻结表、
   AC4/AC5 结构门在含 #423 增量的新基上**本轮重跑**结果不变（13 名 / 0 命中 / 0 计数）。
3. **#420×#423 缝签名交互结构化合法（本轮亲读，§6）**：#423 对内部缝 `sendDataFrame` 追加
   append-only 可选参 `accounting?: HubSendAccounting`（纯 JSON、不进公共面），#420 侧单参实现
   （`hub-session-host.ts:184`、shim `:440`）少参恒可赋值；`sendQueueMs` 经 #420 公共缝整键缺席
   已由 #423 自文注册为合法 dormant；#423 对 `hub-namespace.ts`/`hub-edge.ts` 的改动属父权威演进
   （PR #428 自有闭合链），交付侧对该 DENY 面零 diff 保持。
4. **规范面零违约保持（§6）**：ADR 0032 决策 1–5 原文双侧零改动，#420 澄清附录（:32）与 #423
   决策 5 注记（:68）append-only 并存（本轮亲读）；协议 v1 冻结面交付侧零 diff；CONTEXT.md 与
   前轮批准版逐字节相同；导出并集 13 值名与 #418 冻结表 13 项逐名一致。
5. **无 scope creep**：rebased 交付 commit 相对父基 `25c51cd` 的改动面 = 恰 13 条设计 ALLOW 路径
   （本轮 `git diff --name-only` 亲证）；两个归档 commit 合计 25 路径零业务路径（本轮亲证）。
6. 残余事项全部为在册登记项/流程门（§7），无关键 AC partial/unmet/unachievable。

---

## 0. Rebase 保真度独立核验（本轮核心新增工作）

| # | 核验点 | 本轮独立取证（命令与观察） | 判定 |
| --- | --- | --- | --- |
| R1 | 权威父基与父链 | `git cat-file commit 4e5ff0a`：parent = `25c51cd45a3e4ec1cf8bcdbdcb33ff1f13d1b0df`（= 派工指定值逐位相同）；`25c51cd` = Merge PR #428（父 `1f5809b`+`7333f35`）；`eb5ec09` 父 = `4e5ff0a`、`aff4bc0` 父 = `eb5ec09`；HEAD = `aff4bc0…`；工作树 `git status --porcelain -uall` = 0 条 | ✅ |
| R2 | 真实树 = 双方独立预演树 | `4e5ff0a` tree = **`7b5c1cbc3bb77ea98e7b8669f09896624fde76c4`** —— 与 SA8 iteration 5 §2-4 登记值、SA3 iteration 3 日志 §3.1 独立重取值逐位相同（merge-tree RC=0、输出仅 tree OID ⇒ 零冲突自动合并结果）；`eb5ec09` tree = **`2cee6d03f05fb61f12a37c2a9a41170e60fbef86`** 与全 tip 预演树逐位相同 ⇒ 交付+证据两 commit 均为纯重放，**零手工消解**（含重叠文件） | ✅ |
| R3 | 并集 blob 原样过继 | `git rev-parse 4e5ff0a:packages/ws-replication/src/index.ts` = **`08fa49a1fb84321b92a4cae2da7ee401afdc7ce1`** —— 与 SA8 钉死值、SA3 登记值、前轮交付 `9d2500d` 值逐位相同；`src/index.ts` 不在父增量（SA8 §2-2 同口径，本轮 diff 亲证）⇒ 旧手工并集配方作废、无冲突可解 | ✅ |
| R4 | 非重叠路径零漂移 | 10 条（`CONTEXT.md`、`src/hub-connection.ts`、`src/hub-session-host.ts`、`src/index.ts`、`test/issue420-shim-hub.ts`、#418 contract/structure 两测试、#420 test-d/round/shim-matrix 三测试）`9d2500d` blob == `4e5ff0a` blob，**10/10 IDENTICAL**（本轮逐条 `git rev-parse` 比对） | ✅ |
| R5 | 重叠文件并集完备 | 3 条（`docs/adr/0032-*.md`、`src/hub-session.ts`、`src/hub-split.ts`）：对每条分别取交付侧（`1f5809b..9d2500d`）与父侧（`1f5809b..25c51cd`）新增行全集，逐行 `grep -F` 核对在 `4e5ff0a` 版本中在场——**交付侧缺失 0 / 父侧缺失 0 × 3 条** | ✅ |
| R6 | 删除行 = 精确并集 | `git diff 1f5809b <commit> -- <path>` 删除行计数（剔文件头）：ADR 0032 交付 0 + 父 0 = 终 0；`hub-session.ts` 交付 10 + 父 3 = 终 **13**（实测 13）；`hub-split.ts` 交付 2 + 父 2 = 终 **4**（实测 4）⇒ 零基线行被任一方误删、零超额删除（无手写痕迹） | ✅ |
| R7 | 改动面 = ALLOW 13 条 | `git diff --name-only 25c51cd 4e5ff0a`（剔 `artifacts/`/`wiki/`）= 恰 13 条设计 §11 ALLOW 路径；DENY 面（`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/协议文本/7 矩阵文件）交付侧 diff **空**（本轮亲跑）；`git diff --check 25c51cd 4e5ff0a` RC=0 | ✅ |
| R8 | 归档 commit 零业务路径 | `eb5ec09` = 20 路径（14 artifact 日志 + 简报 + SA8 impl 报告 + SA3/SA4/SA9/SA10 产物，= `52a9e56` 内容重放，树同 R2）；`aff4bc0` = 5 路径（`sa3-issue420-rebase-prep-25c51cd.log` + SA8 iteration 5 报告 + SA3 iteration 3 报告 + SA9/SA10 前轮复审）；两 commit 业务面 diff（`packages docs CONTEXT.md apps domains tests scripts` 等）**空**；`git diff --check 4e5ff0a aff4bc0` RC=0 | ✅ |
| R9 | 无 RA4' 触发 | rebase 实际零冲突（R2 与预演逐位相同 ⇒ 未偏离授权配方）；未触缝类型/wire/公共签名（§6）；无 #420×#423 新组合语义立项面（§6 交互为既有授权面的结构化兼容）；父 head 未再前移（R1 = 派工值）；归档 `--check` 全 RC=0（R7/R8） | ✅ |

## 1. AC1 — SessionHost 工厂从包公共入口导出，签名经 test-d 锁定（SA6 冻结纪律）：**满足（rebase 后本轮重跑）**

| 核验点 | 本轮独立取证（rebase 后真实树） | 判定 |
| --- | --- | --- |
| 公共入口导出 | `src/index.ts` 并集面（blob `08fa49a1…`，§0-R3）：13 值导出 = 基线 11 + `createHubSessionHost`（:6，自 `./hub-session-host.js`）+ `createHubReplicationEdge`（:10，#421 自 `./hub-edge-host.js`）；两工厂各自独立模块来源，无组合面 | ✅ |
| 冻结签名逐字 | `src/hub-session-host.ts` 与前轮批准版**逐字节相同**（§0-R4）⇒ SA6 §12.1 冻结声明（config 7 成员 / 描述子 6 字段 / `authorization: Extract<NamespaceAuthorization,{ok:true}>` / lane 联合 / listener `(Uint8Array,lane)=>number` / 信号两态 / 句柄 5 方法 / `open` 同步返回）在 rebase 后逐字保持 | ✅ |
| test-d 锁定 | `…issue420-session-host-api.test-d.ts` 逐字节相同（§0-R4）：正控全集 + 6 项 `@ts-expect-error` 负控；#421 edge 工厂 test-d 同目录并存（本轮 `ls` 亲证 4 个 test-d 文件）；`vitest.config.ts` 自 `7039f6d` 零 diff（本轮亲证）⇒ typecheck 发现面不变 | ✅ |
| 运行时导出面恰增 | #418 contract 测试 `FROZEN_PRODUCTION_EXPORTS`（真实树 :144-157）= **13 名**（基线 11 + 两工厂，字母序，零删除零重排，本轮亲读），与并集导出面逐名一致 | ✅ |

## 2. AC2 — 内存管道对驱动 OPEN→bootstrap→live update→reconcile→CLOSE 完整回合：**满足（rebase 后复核）**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 验收载体完整 | 回合测试（A1–A12 + C4a–d + C5a–c 锚本轮 grep 在场）与夹具 `issue420-shim-hub.ts`（三分支路由 + 有界 pending + 载体提交 + E10 兜底 + closed 守卫）逐字节保留（§0-R4） | ✅ |
| 装配依赖面在并集下相容 | 夹具 import 面仅深路径（不 import 包入口，mock 安全保持）；其消费的 `createHubReplicationEdge` 签名在 #423 后的 `hub-edge.ts` 中保持不变（:67/:902 本轮亲读）；内部缝 `sendDataFrame(frame, accounting?)` 可选参对夹具单参调用（:440）结构化兼容（§6）；`hub-session.ts` 合并体中 #420 改名（`HubSessionSinkConfig`/:32、`HubSessionSinkImpl`/:43、`createHubSessionSink`/:299）与 #423 记账透传（:61-63 三参箭头、:211-222 可选参）俱在且互不交叠（本轮亲读） | ✅ |
| 无 socket 无 worker | `makeWire()` 内存双端装配不变；§4 结构门本轮重跑 0 命中 | ✅ |
| 回合动态证据 | 既有：SA3 V3/V15/V17（63/63 含 A12 红臂）、SA7 聚焦 63/63 + 三探针 61/61（3×）——绑定 `1f5809b` 基树内容；`25c51cd` 基树重取 = SA8 RA2' 在册流程门（§7-1，交付内容逐字节 = 已批准内容 + 授权并集，§0-R2/R4） | ✅（重取门登记 §7-1） |

## 3. AC3 — 现有 hub-namespace 测试矩阵在 shim 上重跑绿灯（通道零改动 + 状态机零 fork）：**满足（rebase 后复核）**

| 核验点 | 本轮独立取证 | 判定 |
| --- | --- | --- |
| 矩阵文件零编辑 | 7 矩阵文件不在交付 diff（§0-R7）也不在父增量（`1f5809b..25c51cd` 23 路径不含）⇒ rebase 后与基线逐字节相同 | ✅ |
| shim 机制 (a) 完整 | `…issue420-shim-matrix.test.ts` 逐字节保留（§0-R4）：`vi.mock('@nomicore/ws-replication')` 仅替换 `createHubReplication` + `importOriginal` 展开真面 + 动态 import 7 文件 + 末位反空跑（本轮亲读 :28-30）；别名解析面零 diff（`vitest.config.ts` 不变） | ✅ |
| 通道零改动 | 交付 diff 不含 `hub-namespace.ts`/`hub-edge.ts`（§0-R7）；#423 对该两文件的改动属父权威演进（PR #428 自有 SA8 链闭合，SA8 iteration 5 §2-2 同口径） | ✅ |
| 状态机零 fork | 夹具逐字节同前（仍零应答合成/零错误码选择/零 FSM） | ✅ |
| 重跑计数自洽 | `25c51cd` 基树包套件预期 **90 files**（87 + #423 三测试文件，SA8 RA2' 明文）——实际重取未落档，属 §7-1 流程门；M4 反空跑负控日志随 `eb5ec09` 入库 | ✅（重取门登记 §7-1） |

## 4. AC4 — 缝两侧只过 Uint8Array 与纯 JSON；包内零 worker 依赖/类型：**满足（rebase 后本轮重跑）**

| 判据 | 本轮独立取证（rebase 后真实树） | 判定 |
| --- | --- | --- |
| C4a 结构门 | **本轮重跑** `grep -rnE 'worker_threads\|MessageChannel\|MessagePort' packages/ws-replication/src packages/ws-replication/package.json` = **0 命中**（exit 1）——含 #423 改动后的 `hub-edge.ts`/`hub-namespace.ts`/`hub-session.ts`/`hub-split.ts`/`update-channel.ts` 全量新基 | ✅ |
| 纯 JSON 投影 | #423 新增 `HubSendAccounting` = 纯 JSON `{sendQueueMs?: number}`（`hub-split.ts` :70 区域本轮亲读，明文「只过差值、缺省 = 成员缺席、不进 `src/index.ts`/`src/testing.ts`」）——缝纯度不变 | ✅ |
| C4b/C4c/C4d | 承载断言的回合测试逐字节保留（§0-R4） | ✅ |

## 5. AC5 — session 侧重检入站 sequence 的代码不存在：**满足（rebase 后本轮重跑）**

| 判据 | 本轮独立取证（rebase 后真实树） | 判定 |
| --- | --- | --- |
| C5c 结构门 | **本轮重跑** `grep -c expectedSequence src/hub-session-host.ts` = **0**（文件本身亦逐字节同前，§0-R4） | ✅ |
| C5a/C5b 行为锚 | 承载用例逐字节保留（§0-R4）；M5 变异红证据随 `eb5ec09` 入库 | ✅ |

## 6. 规范一致性、#423 交互与 scope 核验（rebase 后）

| 面 | 核验（本轮） | 判定 |
| --- | --- | --- |
| ADR 0032 决策 1（FSM 单份） | 交付侧 `hub-namespace.ts` 零 diff（§0-R7）；公共工厂内部复用 splice 的实现文件逐字节同前（§0-R4） | ✅ |
| ADR 0032 决策 2（字节/纯 JSON 缝、序纪律、信号面） | §4/§5 本轮重跑；#423 `HubSendAccounting` 纯 JSON append-only 投影不违缝纯度 | ✅ |
| ADR 0032 决策 3（authorize 在 edge、投影传递） | 实现逐字节同前；附录 A2 β 文本在 ADR 0032 中保留（:32 澄清附录本轮亲读在场） | ✅ |
| ADR 0032 决策 4/5（路由键、dormant 降级、observer 发射点） | 相关 DENY 面交付侧零 diff；adapterPort 实现逐字节同前；#423 决策 5 注记（:68）明文「决策 1–5 与否决备选原文零改动」（本轮亲读），发射点归属与 #420 附录同原则正交 | ✅ |
| ADR 0032 后果节 append-only | 并集 = 三处 append-only 文本（#420 附录 :32 / #421 后果行 / #423 注记 :68）机械并存（§0-R5/R6）；#418 冻结表 13 名逐名一致（§1） | ✅ |
| 协议 v1 冻结面 | `docs/protocols/instance-replication-v1.md` 交付侧零 diff（§0-R7）；父侧 #423 的 19 行注册全 append-only（字段集零变化）且经其自有链闭合（SA8 iteration 5 §2-2） | ✅ |
| #420×#423 缝签名交互 | `hub-split.ts:95` `sendDataFrame(frame, accounting?: HubSendAccounting)`（append-only 可选参）× `hub-session-host.ts:184` 单参实现 / shim `:440` 单参调用 ⇒ 少参恒可赋值，结构化合法（本轮亲读三处原文）；`sendQueueMs` 经 #420 公共 byte 缝整键缺席 = #423 自文注册的 dormant 形态（ADR 注记 :68「工厂/宿主直驱 data 帧无 session 记账 ⇒ 该键整键缺席」） | ✅ |
| CONTEXT 词条（E1/E2 闭合义务） | `CONTEXT.md` 与前轮批准版逐字节相同（§0-R4），「SessionHost」词条公共工厂轨句与 #421 增补并存在场 | ✅ |
| 非目标边界（无 scope creep） | 未触 peer 侧拆分、真 worker 传输、服务轨、跨进程 revoke、wire 格式；交付改动面恰 13 ALLOW 条（§0-R7）；归档 commit 零业务路径（§0-R8） | ✅ |

## 7. PR 必须披露的未达成/登记项（均不阻断 approve）

1. **SA8 RA2' 五门在 `25c51cd` 基树重取未落档（流程门，非 spec 缺陷；本轮直陈）**：已归档全部门证据
   （含第一段 rebase 干跑门 V17–V20、AC3 listen 7/52）绑定 `1f5809b` 基树内容，按树绑定纪律不闭合
   新基树；`25c51cd` 基树上**尚无任何已执行门证据**（本轮全仓亲查：仅 SA8 iteration 5 / SA3
   iteration 3 两报告引用新基，SA4/SA7 无 post-rebase 产物）。重取增量（SA8 RA2' 明文）= #418 契约
   exact-equal + #420 三契约、双 test-d、包全量（预期 87 → **90** files）、根 typecheck（覆盖 #423
   缝签名 × `hub-session-host.ts`/`issue420-shim-hub.ts` 编译面）、AC3 矩阵（shim 53 + listen 7/52）
   于 #423 改动后 src 之上逐字重跑（#420×#423 行为交互的决定性证据）。本项不削弱 AC 满足判定
   （交付内容逐字节 = 已批准内容 + 双方独立预演逐位相同的零冲突并集，§0-R2/R4；AC1/AC4/AC5
   结构门本轮已在真实树重跑全绿），为**合并前阻断性流程门**（Controller + SA4/SA7 证据链持有，
   SA8 形式核对闭合）。
2. **设计文本滞后一行（SA8 RA1''，wiki 内务，Controller/SA1 持有）**：实现「载体提交」机制偏离
   设计 §7 D7 `namespaceFrame` 行字面；SA8 已裁 implements-existing-decision，SA7 A/B 探针证
   逐字节等价；待办 = 设计 D7 行文本补正 + 附录 A2 β 措辞对齐。本段 rebase 不改变其状态。
3. **反空跑锚替换（SA3 Deviation 3 / SA8 行 22，no-conflict）**：末位反空跑锚 = `settled≥1` +
   零 `INTERNAL_ERROR` + 计数阈值；M4 变异证非恒真，验收语义未弱化。
4. **U2 真 worker 形态未解（明示非目标）**：本票只冻结同步宿主 pipe 面；异步序回传与跨线程
   pending 义务留后续票。PR 不得声称已解决真 worker 形态。
5. **服务轨/宿主接线为后续票**：`listen:false` 插件 + `nomicoreHubSessionHost` 服务、peer 侧拆分、
   nomic-server 宿主接线、跨进程 revoke 全链路 = 明示非目标。
6. **观测边界登记（R6/R7/R11/R12）**：`selectedCapabilities` 单 bit 反推；shim 下 authorized 通道
   不投影 `edge.channels`；在途路由期 revoke 的 wire 时序观测边界；桥 accept 门链保真度差异清单——
   全部在夹具头注/设计 §13 登记，防误当规范宿主样例。
7. **公共 host `sessions` 表无删除路径（SA4 O4）**：冻结语义「session 对象随连接存活」的字面兑现；
   未来跨连接复用单一 host 的宿主须先明确生命周期约定（服务轨票）。
8. **SA6 三个诊断探针陈旧名（SA8 RA4''）**：`artifacts/sa6-issue420-{capability-gap,causality,
   sequence-discipline}-probe.mts` 仍 import 重命名前旧名；不在任何 gate include 面，零 gate 影响。
9. **夹具头注指针陈旧（SA8 RA3，非门禁卫生项）**：`test/issue420-shim-hub.ts:93` 头注
   「镜像 `hub-connection.ts` 的 `MAX_EARLY_FRAMES` 先例」——#421 已把该常量逐字搬迁至
   `hub-upgrade-admission.ts`（值 16 不变）。注释级指针更新归交付执行者，常数值不得动。
10. **SA8 RA5' 新增跨票账（承接登记）**：#423 记账投影（`sendQueueMs`）已授权 append-only 纵贯
    内部缝（纯 JSON）；后续票若要使其穿透 #420 公共 byte 缝，属既有授权面的实现票，签名变化须
    重过 SA8。本票不改变公共缝形状（§6）。
11. **证据打包（已闭合）**：两归档 commit 合计 25 路径全部入库（§0-R8），业务面零 diff，
    `git diff --check` 两 commit 各 RC=0；工作树零脏（§0-R1）。

## 8. 结论

第二段 rebase 后最终交付对 Issue #420 的五条 AC **全部满足且无部分实现**：全部验收载体逐字节
保留、真实树与 SA8/SA3 双方独立零冲突预演树逐位相同（纯机械重放零手工消解的铁证）、两侧内容
零丢失、删除行精确并集、结构门在新基上本轮重跑结果不变；#420×#423 缝签名交互结构化合法；
冻结契约与规范面零违约保持；无 scope creep。残余项全部为在册登记项与合并前流程门（§7），其中
§7-1 的 RA2' 五门真实树重取为 Controller + SA4/SA7 证据链持有、SA8 形式核对闭合的阻断性流程门。
**approve**。
`requiresConflictRecheck: true`（窄域承接 SA8 iteration 5 武装态：RA2' 五门在 `25c51cd` 基树
证据落档后形式闭合；本轮未发现新的决策冲突面）。

## 附：artifactPaths（worktree-relative）

```text
wiki/raw/task_issue-420_sa10_spec.md
```
