# SA4 实现静态审查 — Issue #451（γ-T5）：观测面锚定与全量回归收官（implementation-review，iteration 0）

- SA4 dispatch：`sa-4760e6ac-b588-4350-9c22-1a2b9678fb7d`（mabf-sa4 / implementation-review / iteration 0）
- 审查对象：**已完成的 #451 实现面**（两份 #451 契约测试文件、`packages/ws-replication/AGENTS.md` D2 登记、证据族）+ SA3 实施报告 + SA8 实现后冲突门禁（`clear`）结论，对照 **SA6 rev2 验收契约**与 **SA1 设计 iteration 1**（均经 SA2 r2 `approve` / SA8 iter-2 `clear`）。
- 审查基线 worktree：`/home/wangjian/nomicore-fix-issue-451`（分支 `mabf/issue-451`，HEAD `68ab9f5bfe4df66a54faddf759709a76914332d0`，本审查 `git rev-parse` 复核未前移）。
- Owner 评论：REST 快照 `[]` @2026-09-22T14:29Z（dispatch 提供；此前 12:33–13:57Z 八个时点连续为空）——无 owner 追加要求可映射（与 SA6 §2 / SA8 impl §2 同判）。
- 审查方式：纯静态（源码/测试/夹具/规范逐锚重读、`sha256sum`/`git status`/`git diff` 只读复核、证据日志尾行与首部抽验）；未运行测试、未启动服务、未修改任何被审产物。唯一写入 = 本文件。

---

## 1. Reviewed inputs

| 输入 | 状态 | 核验方式 |
|---|---|---|
| `wiki/raw/task_issue-451.md`（Host 简报；5 AC；Comments 空） | 在案 | 逐条读取 |
| `wiki/raw/task_issue-451_design.md`（SA1 iteration 1，rev2 对齐修订，381 行） | 在案 | 全文精读；§7-D1/§11/§12 逐项对照 worktree 实况 |
| `wiki/raw/task_issue-451_sa6_contract.md`（SA6 **rev2**，§12.5 边界裁定 + EV-1..EV-8 + §12.4 一致性表） | 在案 | 全文精读；契约工件 sha/行数/边界锚独立复验 |
| `wiki/raw/task_issue-451_sa2_review.md`（iter-1 `reject`）/ `_sa2_review_r2.md`（iter-2 `approve`） | 在案 | 精读；本轮无 SA2 待办 finding 落到实现面 |
| `wiki/raw/task_issue-451_sa3_impl.md`（SA3 iteration 1：零新增代码改动 + 门禁复跑留证） | 在案 | 精读；§2/§6 全部事实声明逐项独立复验（见 §2/§9） |
| `wiki/raw/task_issue-451_design_conflict_report.md`（SA8 iter-2 `clear`）/ `task_issue-451_implementation_conflict_report.md`（SA8 实现后冲突门禁 `clear`） | 在案 | 精读；本审查在其后按 SA8 §8 移交登记执行 |
| `task_issue-451_relevant_decisions.md` / `_conflict_report.md` / `_sa7_report.md` | 不存在（glob 核验） | 非阻塞：SA8 已直接重读 ADR/协议原始文本替代（impl §2 同判） |
| 契约工件两份 | 在案 | `sha256sum` + `wc -l` 复验（见 §2 首行） |
| 证据日志 41 文件（40 `.log` + `clientid-probe.mjs`） | 在案 | 关键日志尾行/首部抽验（§9） |
| 规范权威（协议 §23.1/§24、ADR 0032 附录 A4、模块 AGENTS） | 在案 | 逐锚重读（§4/§5） |

时间线（mtime 核验）：brief 20:33 → surface-freeze test-d 20:38 → anchor rev2 21:33 → SA6 rev2 21:52 → SA2 iter-1 22:01 → SA1 设计修订 22:09 → SA8 iter-2 22:20 → SA2 r2 22:21 → SA3 impl（原位更新）22:42 → SA8 实现冲突门禁 22:47 → 本审查。顺序与各报告自述一致，无倒置。

## 2. Verdict

**`approve`** —— 无 BLOCKER / MAJOR finding。

核心结论：本票实现面 = **SA6 rev2 契约实体（sha 三方一致钉死）+ D2 单行文档登记 + 证据族**，生产 `src/**` 零改动不变量成立（本审查 `git status --short packages/ws-replication/src/` = 空）。rev2 断言边界经逐行静态审计**结构性成立**（不只是经验性 40/40）：跨轮比较字段全部为非 RNG 量——`type`/`side` 恒定、`namespaceId` 由夹具计数随机源 `makeCounterRandomBytes()`（`harness.ts:270-284,509`）确定性生成（每 boot 首次 `registry.create` ⇒ counter=1 ⇒ 同一 nsId，`registry.ts:956-983` 生成器 + 探针「单 nsId 恒定」互证）、`sequence` 由确定性协议帧序产生；唯一 CSPRNG 量（live doc `clientID` varint 宽度 ⇒ 载荷长）已被移出跨轮判据面、改为每轮对本轮 wire 载荷自证（`:372-389`），且 M3 mutation（3/9 红含 ORDER-C1）证明该形态对对称字节说谎仍敏感。SA3 报告的全部事实声明与证据日志经独立抽验**零矛盾**。残余 4 条 MINOR 观察项（§12）不阻断。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| AC1 `update-sent` 锚 edge 盖章点；`update-acked`/chunked 族锚 session；断言不依赖跨线程相对顺序 | anchor 契约 9 用例（EDGE-C1/C2/NC1/NC2、SESSION-C1/C2、BOTH-C1、ORDER-C1/C2）逐行审计（§9）；源码锚 `hub-edge.ts:284-288`（`sequence > 0` 门）、`:869-886`（`emitUpdateSentAtStamp` 无 observer 首行门 + `updateFrameProbe` 型门）、`hub-namespace.ts:1462`（普通帧零发射抑制点）、`:1416-1440`（`onUpdateAcked`）全部本审查重读命中 | 落实。归属判别面 = 单侧 observer 注入（夹具 `bootFlowRound` 把同一 recorder 分别注入 edge facade / session 宿主，`issue450-flow-seam.ts:181-197`）；M1=5/9、M2=4/9 mutation 红灯落点与归属断言一一对应 |
| AC2 新公共面 test-d append-only 复核 | surface-freeze test-d（74 行）：`keyof HubAsyncSessionHost = 'open'`（:41）、β 监听器同步返回 `number`（:48）、`asyncDataAdmissionFatal: true \| undefined`（:54-56）+ 2 处活体 `@ts-expect-error`（:66/:72）；`git diff c86ccbc..HEAD -- src/index.ts` = **+11/−0**（本审查 stat 复核，12/1 的 grep 计数含 diff 头行） | 落实。双入口发现（`vitest --typecheck` glob + 包 `tsconfig.json` `include: test/**/*.ts`，本审查复核两配置） |
| AC3 listen + β 矩阵 + parity guard 全绿 | SA3 复跑新鲜证据 `-sa3-r2-matrix-and-tsc.log`：**20 files / 273 tests 全绿 + Type Errors: no errors**（本审查读日志逐文件清单，与设计 §12 行 5 的 20 文件枚举逐一相符；`-sa3-r2-file-set.log` named-file count=20） | 落实（口径强于设计要求的「rev1 证据保持」——SA3 直接复跑了矩阵） |
| AC4 包 typecheck + 根 `pnpm typecheck` / `pnpm test` 全绿 | 包 tsc exit 0；根 typecheck 15 段链 exit 0；根 test 2× **468 files / 5675 tests** 全绿 + `Type Errors: no errors`（`-sa3-r2-root-typecheck-test.log`，日志首部备案 HEAD + anchor sha，两 #451 契约被逐文件列出）；包套件 3× 105/945（`-sa3-r2-package-suite-3x.log`）；EV-1 40/40（`-sa3-r2-contract-determinism.log` 尾行 `totals: FAIL=0 PASS=40`） | 落实（EV-1 ≥30 / EV-2 ≥3 / EV-3 ≥2 口径全部达标） |
| AC5 PR #446 与 ADR A4 / §24 一致性核对 + 收官转人工合并 | 一致性结论 = SA6 §12.4（18 条款；本审查对 §24.2/§24.8/§23.1 与 A4.1/A4.2/A4.7/:112/:114 行锚重读抽验相符）；O-1/O-2 = D2 已落地（见 §4）；「转人工合并」按 §7-D3 维持人工移交，SA 全程零 git 生命周期操作（本审查 `git status` 复核无 add/commit 迹象） | 落实（核对半句可勾；尾句为移交项） |
| SA6 rev2 §12.5 边界裁定（跨调度只比调度不变量；`bytes` 单轮自证） | 契约本体即该形态：`anchorProjection` :118-133 键集 = `type/side/namespaceId/sequence`（**无 bytes**）、投影 `toEqual` :371、逐轮自证 :372-389、缺帧响亮 throw :141-143；SA3 `-sa3-r2-boundary-audit.log` 静态审计 + 本审查逐行独立复核一致 | 落实（sha `4a8556bb…` 与设计 §7-D1/SA6 §12.1/SA3 §2/日志首部五方一致） |
| SA8 R-1b 禁止回退（M3 ≥3/9 且含 ORDER-C1） | `rev-mutations-M1-M2-M3.log`（M3 = 3 failed：EDGE-C1/C2 + ORDER-C1，restore identical=True）+ `rev-M3-boundary-compare.log`（rev1 边界 2 红 `['ANCHOR-EDGE']` vs rev2 边界 3 红 `['ANCHOR-EDGE','ANCHOR-ORDER']`，本审查读日志原文核对） | 落实；rev2 严格更强的量化主张成立 |
| SA2 r2（iter-2 `approve`，无实现面待办）与 SA8 两份 `clear` | SA2 N-A..N-F 均为文本级观察（SA1/SA6 面）；SA8 impl §8 移交登记①②（门禁复跑 / EV-7 收尾）已由 SA3 兑现、③维持人工 | 无待办落到本轮实现面 |
| Owner 评论 | `[]` @14:29Z（第九个连续空快照） | 无映射项；需求全集 = 5 AC |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7-D1 契约冻结（两文件钉 sha，终验不得再改） | `sha256sum` 本审查复验：anchor = `4a8556bbecb775fd70a054051ee6599f9600ea01e9a26700a4818ad683bc3b4c`（432 行）/ surface-freeze = `ef897240096c78a0b45e04cb5cc77f777a351b744a720f86c72a892520c42184`（74 行）——与钉死值逐字相同 | 落实（EV-7 sha 门通过；SA3 零触碰） | — |
| §7-D1 边界规则（跨独立 boot 字节相等禁入契约） | 全文 `.bytes` 断言 5 处（`:173`/`:202`/`:277`/`:381`/`:385`）全部对本轮 wire 载荷自证（本审查逐处核读）；无任何跨 boot 字节相等断言残留 | 落实（与 #424 ORACLE-2 / #418 C3 仓库口径同构——两先例原文本审查重读在场） | — |
| §7-D2 收官登记（已完成态；再编辑需新裁定） | `git diff --stat packages/ws-replication/AGENTS.md` = **1 insertion / 0 deletion**（本审查复核）；bullet 落于 :18，内容含：专用 FIFO 通道对、回执盖章点同一同步段投递、`ACK_STATE_VIOLATION` 1002 + §24.2.6、edge 工厂 observer（含拒绝路径复刻事件 `namespace-error{direction:'sent'}` / `namespace-failed{cause:'open-failed'}` 括注）、session 宿主 observer、no-total-order「never merged-array order」纪律句、参考夹具 `test/issue447-async-seam.ts` | 落实。语义对照协议原文逐点相符（§24.2 义务 1–3 + 第 6 条「违反 1–3 = 宿主 bug」、§23.1 归属表 edge/session/拒绝路径三行、§24.8 三句）；引用符号全部可解析（`handleReceipt` `hub-session-async-host.ts:70`；`ACK_STATE_VIOLATION` 1002 `hub-namespace.ts:693-700`（pending = γ 回执未到而 ACK 先到 = 宿主违契分支，语义精确）与 :1166；夹具 `:539` ★ A4.2/§24.2.3 注释在场）；`git diff --check` exit 0 | — |
| §7-D3 收官路由（R-1→R-2→终验→人工合并） | SA8 iter-2 `clear`（R-2 闭合）在案；SA8 实现后冲突门禁 `clear` 在案；本审查即终验静态半场；无 SA 执行 git 生命周期操作 | 落实 | — |
| §7-D4/§9 ER-2（再红即阻塞、禁重跑碰运气） | 纪律为文本义务（无运行时面）；SA3 iteration 0 曾实际遵守（遇红 `reject` 而非修断言）——历史行为证据在案 | 落实 | — |
| §12 EV-1..EV-8 口径 | EV-1 40/40（SA6 + SA3 各一轮）、EV-2 3×105/945、EV-3 2×468/5675、EV-4/EV-5 历史证据闭合（M1/M2/M3 + 边界对照 + restore）、EV-6 探针复跑（`-sa3-r2-clientid-probe.log`：宽度 1:1，预测不匹配率 0.117393 与 SA6 0.116521 相容）、EV-7 双时点核对（src 空 / sha 不变 / HEAD 不前移）、EV-8 设计收口（SA2 r2 + SA8 iter-2 `clear`） | 全部落实（日志尾行/首部本审查抽验相符） | — |
| §8 接口/状态机/数据流零变化 | `src/**` status 恒空（本审查）；wire/事件面/缝词汇零改动；契约只观测不改面 | 落实 | — |

设计明确但实现缺失项：**无**。

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| `update-sent` 发射（盖章事实所有者） | edge（`port.sendDataFrame` 单漏斗） | `hub-edge.ts:284-288,869-886` | 正确（事实与发射同侧；`seq>0` 门 + 型门在位） |
| 普通帧 `update-sent` 抑制（防双发） | session 侧结构性第二点 | `hub-namespace.ts:1462`（`info.chunked === undefined → return`） | 正确 |
| `update-acked`/chunked 族结算发射 | session | `hub-namespace.ts:1416-1440` | 正确 |
| 回执盖章点同步投递 | 宿主义务（参考具现 = 夹具） | `issue447-async-seam.ts:519-546`（`sequence === 0` 不投回执分支在位） | 正确（D2 已登记归属边界） |
| 验收契约断言边界 | SA6（契约 owner） | rev2 实体 + sha 谱系 | 正确（一次性例外已闭合，再修改三条件在 §11 DENY） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| 单轮 wire 自证断言形态 | #447/#448/#449 语义判据先例 | EDGE-C1/C2、SESSION-C1、ORDER-C1 逐轮自证同款 | 一致 | 无新机制 |
| 数据帧字节判据口径 | `#424:16` ORACLE-2、`#418:21,117-119,460` | 跨 boot 字节相等零残留 | 一致（回归口径） | rev1 是口径违例，rev2 回归 |
| 收官证据落档 | `artifacts/sa6-*.log` 族 | `sa3-r2-*` 9 份新日志同族同通道 | 一致 | 无平行机制（`-r2-` 中缀不覆盖历史） |
| 模块 docs 登记 | AGENTS.md Boundaries bullet 惯例 + docs/AGENTS.md「link to authoritative source」 | D2 单 bullet 引用 §24.2/§24.8/A4.2/A4.7 | 一致 | 不复制规则本体 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 契约当前内容 | 文件实体 + sha `4a8556bb…`（设计/SA6/SA3/日志首部五方一致） | 各报告描述 | 低（EV-7 sha 门） |
| rev1→rev2 修订史 | SA6 §0/§12.5 + sha 谱系 | 设计 §7-D1 修订史表（登记非第二源） | 低 |
| 生产零改动 | `src/**` status（恒空） | 各报告声明 | 无 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| （零运行时面：纯测试 + 单行文档登记；契约用例内 `bootFlowRound` 一次性 round，无跨用例共享状态） | — | 夹具 throw 均为响亮前置失败（如「acceptTrusted 未分配连接」） | 不适用面无对称性缺口；`passWithNoTests: true` 为仓库既有全局配置（非本票引入） |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二套探针/验收入口/修订绕道 | 无（临时 `zz-*` 探针已删，`test/` 零残留，本审查 glob 复核） | 全走仓库真实入口 | 无平行 |

## 6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/ws-replication/AGENTS.md`（tracked，+1/−0） | §11 ALLOW 行 2（维持态） | D2 收官登记 | 相符：恰 1 insertion，零删除，`:17` 既有 bullet 未动 |
| `packages/ws-replication/test/ws-replication-issue451-gamma-observability-anchor.test.ts`（untracked 新增） | SA6 rev2 契约本体（设计 §7-D1/§11 DENY 钉 sha；SA6 §16 最终变更面明列） | AC1 可执行载体 | 相符：实体 = 批准 rev2（sha 逐字相同），非 DENY 违约产物——设计 §10 行 4 防误导读法正确 |
| `packages/ws-replication/test/ws-replication-issue451-gamma-surface-freeze.test-d.ts`（untracked 新增） | 同上（AC2 载体，sha 钉死） | AC2 可执行载体 | 相符（sha 逐字相同；自落地零改动） |
| `artifacts/sa6-issue451-*`（41 文件 = 40 log + probe.mjs；其中 `sa3-r2-*` 9 份为 SA3 新增） | §11 ALLOW 行 3（族内复跑更新/新增） | EV-1..EV-7 证据 | 相符：`-r2-` 中缀不覆盖历史；rev1 历史日志保留 |
| `wiki/raw/task_issue-451_*.md`（8 份既有 + 本文件） | 各 SA 固定产物 | 过程产物 | 相符（非 SA3 越权写入） |
| `packages/ws-replication/src/**` | DENY | — | **恒空**（本审查 status 复核 = 0 行输出） |
| 夹具（`issue447-async-seam.ts`/`issue450-flow-seam.ts`/`harness.ts`/`driver.ts`）与既有 issue418–424 测试 | DENY | — | 未触碰（最后 commit = `b1d854b` #450；`test/` untracked 仅两 #451 契约文件） |
| `docs/protocols/**`、`docs/adr/**`、`CONTEXT.md` | DENY | — | 零 tracked 修改（全仓 tracked diff 仅 AGENTS.md 一处） |

无 ALLOW 外写入；无 DENY 违约；无 `.git` 生命周期操作迹象。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 生产 API/wire/事件面 | 全部 `src/**` 消费者 | 逐字节不变（src 零 diff） | 无 | — |
| vitest 运行器发现 | 包套件 / 根 `pnpm test`（`vitest run --typecheck`）/ CI | `vitest.config.ts` `include: packages/*/test/**/*.test.ts` + `typecheck.include: …*.test-d.ts` 命中两文件（本审查读配置 + 根测日志逐文件列出 anchor (9 tests) / surface TS (3 tests)）；包测试文件总数 = 98 `.test.ts` + 7 `.test-d.ts` = 105 与套件计数一致 | 无 | — |
| 类型入口 | `tsc -p packages/ws-replication/tsconfig.json`（`include: test/**/*.ts`）+ 根 15 段 typecheck 链 | 覆盖 test-d；exit 0 | 无 | — |
| 未来模块 agent / 宿主集成方 | 读 `AGENTS.md` 装配 γ 桥 | :17 装配义务 + :18 宿主运输/观测纪律并列可见，权威源引用不复制本体 | 无 | — |
| issue422 两文件（不在 AC3 命名集） | AC4 全量门禁 | 在 105 文件包套件与 468 文件根全量内 | 无（设计 §13 R-3 显式登记） | — |
| PR #446 人工合并者 | 收官材料四件套 + SA8 impl 报告 | 移交登记在案（SA8 impl §8） | 无 | — |

无未覆盖 caller；本票不改任何签名/返回值/抛错/异步时序。

## 8. 错误、恢复与并发

- **静默失败**：契约判据面缺失 = 响亮 throw（`payloadBytesAt` `:141-143`，本审查核读原文在位）；每个「零命中」断言同场必有正命中（NC-4 元判据：NC1 的 `connection-failed` ×1、SESSION-C1 的 `update-acked` ×1、NC2 的 `chunked-update-sent` ×1 + chunk 戳记在场）——无空转零断言、无 fallback。
- **确定性（结构性论证，本审查独立复核）**：跨轮 `toEqual`（`:371`）比较的字段全为非 RNG 量——`type`/`side` 字面恒定；`namespaceId` 走 `makeCounterRandomBytes()`（`harness.ts:270-284`，计数器源；`:509` 装配）⇒ 每 boot 首个 `registry.create` 得 counter=1 ⇒ nsId 跨 boot 恒定（`registry.ts:956-983` 生成器 + `order-rng-probe2.log` 240 boot「单 nsId 恒定」互证）；`sequence` 为确定性协议帧序（probe2 `sequence=[7]`）。唯一 CSPRNG 量（live `Y.Doc` `clientID` ⇒ 载荷长，`doc-runtime/create-initial-document.ts:160` 本审查核读裸 `new Y.Doc()` 在位）已结构性移出跨轮判据面。合成直驱帧另钉 `clientID = 424242`（`makeLargeUpdateFrame`）。
- **敏感性**：M1=5/9、M2=4/9（红灯含 SESSION-C1 ⇒ 镜像负控真实接线）、M3=3/9 含 ORDER-C1（⇒ 逐轮自证对对称字节说谎敏感；rev1 边界仅 2/9）——三路 mutation 红灯集合本审查读日志逐 ID 核对，与契约断言面一一对应；`[restore] identical=True` 证明 mutation 零残留。
- **重试/幂等**：`close` 幂等与收口语义未被触碰；恰一断言钉住双发（M2 实测）。
- **ORDER-C1 再红处置**：设计 §9 ER-2 三分类 + 阻塞上报纪律在案；静态无新 RNG 混入面（唯一随机源 clientID 已隔离；`random: () => 0.5` 钉死背压/退避面）。
- 无法静态确认的运行期风险 → §11 动态验证项。

## 9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| ANCHOR-EDGE-C1（:150-180） | 仅 edge observer：恰一 `update-sent{sequence=wire 序, bytes=本轮载荷长, namespaceId=路由键}`；`sendQueueMs` 整键缺席；session 域 8 型零命中（因果门：UPDATE_ACK 已交付 session） | vitest（包套件 + 根全量 + 聚焦） | 无——全部运行时行为断言（wire 记录 / observer 事件 / 缝投递），零源码字符串断言 | — |
| ANCHOR-EDGE-C2（:182-203） | egress 直驱（零 data tag 证明不过 session）仍恰一，`sequence` = 返回值——锚在盖章点的判别性证据 | 同上 | 无 | — |
| ANCHOR-EDGE-NC1（:205-227） | 超限帧返回 0 + `FRAME_TOO_LARGE` 收口 + 零 `update-sent` + 零 wire 字节；`connection-failed` 正命中证记录器活 | 同上 | 无 | — |
| ANCHOR-EDGE-NC2（:229-252） | kind=0 分块：每 chunk 盖章、普通族零 `update-sent`、`chunked-update-sent` 恰一在 session | 同上 | 无 | — |
| ANCHOR-SESSION-C1（:258-283） | 仅 session observer：`update-acked` 恰一（seq/bytes 对本轮 wire 自证）、零 `update-sent`、连接域 6 型零命中 | 同上 | 无——镜像负控非空转：M2（session 发射恢复）实测令其红 | — |
| ANCHOR-SESSION-C2（:285-305） | chunked 族归 session 恰一；普通族与连接域零命中 | 同上 | 无 | — |
| ANCHOR-BOTH-C1（:307-327） | 双 observer 共 recorder：两型各恰一同 wire 序（无双发） | 同上 | 无——recorder 为同一 `makeAsyncObserver()` 实例双注入（`issue450-flow-seam.ts:181-197` 本审查核读） | — |
| ANCHOR-ORDER-C1（:333-396，rev2 边界） | 两调度投影逐字相同 + 计数恰一；每轮 `sent/acked.bytes === 本轮 wire 载荷长`；`acked.sequence === sent.sequence`；投影回指 wire 序 | 同上 | 无——无合并数组下标、无跨轮字节相等（§8 结构性论证） | — |
| ANCHOR-ORDER-C2（:398-431） | 因果门：扣留期 sent ×1 / acked ×0 / `pending() > 0`；释放后各恰一同序 | 同上 | 无 | — |
| SURFACE-C1..C3 + 2 负控（test-d） | `keyof` 冻结 / β 签名 / 精确 `true`；γ→β 冒充与 `false` 标记被 `@ts-expect-error` 拦截（未触发即 TS2578 红） | `vitest --typecheck` + `tsc -p` 双入口（均 exit 0 / 3 passed） | 无 | — |

汇总核验：anchor `it(` 计数 = 9（本审查 grep）；两文件零 `skip/only/todo`（grep 命中均为 `readonly`/`append-only` 子串误命中，无真实修饰符）；零 env override；夹具复用（#447/#450 seam + harness/driver）零改动；每用例 30s 超时与注入调度器显式泵（`pumpUntil`/`pumpSteps`/`settle`）配套，零真实 timer/网络/worker_threads。红灯敏感性由 M1/M2/M3 三路 mutation + 修订前 4/30 采样双向证明。测试被真实 runner 发现（§7）。**未发现任何弱化或无效测试面。**

## 10. Required revisions

无 BLOCKER / MAJOR finding。

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
|---|---|---|---|---|---|---|
| （无） | — | — | — | — | — | — |

## 11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| CI/集成分支环境差异（Node/pnpm/vitest 版本与本地基线不同）下门禁再现性 | 人工合并前在 CI 复跑设计 §12 门集（EV-1 聚焦 ≥30×、EV-2 包套件 ≥3×、EV-3 根 test ≥2×） | 全绿（105/945、468/5675、`Type Errors: no errors`） | 任一红 = 按 §9 ER-2 阻塞上报并按 EV-4/EV-5 重做 mutation 定位；禁止重跑碰运气 |
| ORDER-C1 在异构调度（真实多线程宿主、CI 并行 worker）下的投影稳定性 | 合并后 γ 面任何变更的回归运行 | 调度不变量投影仍逐字相同（判据面无 RNG 派生量 ⇒ 再红只能是真回归） | 红灯即回归/新 RNG 混入，重开冲突复查（SA8 impl §8 谱系警戒①） |
| HEAD 前移（收官前集成分支再进 commit） | `git rev-parse HEAD` 收尾核对 | 维持 `68ab9f5`；前移 ⇒ 设计 §13 R-4：§12 全表 + AC5-a 同口径重核 | 证据过期未重核即宣称收官 |
| D2 文本后续再编辑偏离规范语义 | 模块 AGENTS 后续 diff 审查 | 维持单 bullet +1 行；符号引用可解析 | 偏离 §24.2/§24.8/§23.1 语义 ⇒ 重开冲突复查（谱系警戒③） |
| PR #446 人工合并（AC5 尾句） | 人工 | 以四件套收官材料执行 merge | 任何 SA 代执行 git 生命周期操作 |

## 12. Non-blocking observations

| ID | 位置 | 观察 | 建议 | 接受条件 |
|---|---|---|---|---|
| N-1 | `task_issue-451_design.md:110`（§5.1）与 `:348`（§14）；同款见 `task_issue-451_design_conflict_report.md:86`、`task_issue-451_implementation_conflict_report.md:97` | 「根 2×**4675**」为数字笔误——全部证据日志实际为 **5675**（`rev-root-test{-2nd}.log`、`-sa3-r2-root-typecheck-test.log` 尾行一致；本审查读日志核对） | 纯文本级；无任何可执行判据依赖该数字。未来任一产物再开修订时顺手改 5675 | 数字与日志一致即闭合 |
| N-2 | `task_issue-451_implementation_conflict_report.md` §1 D-4 | 「artifacts/sa6-issue451-*（**44 文件：43 .log** + probe.mjs）」计数漂移——实际 **41 文件 = 40 .log + 1 .mjs**（设计时点 32 + SA3 `sa3-r2-*` 9 份 = 41，本审查 `ls` 精确计数） | SA8 产物内的计数笔误；无执行面影响。后续产物引用文件数时以 `ls` 实数为准 | 计数与实数一致即闭合 |
| N-3 | SA6 rev2 §14 runner-trigger 表述 | 「包套件/根测试日志**逐文件列出**」——包套件两份日志（`rev-postfix-suite-3x.log`、`-sa3-r2-package-suite-3x.log`）实为汇总行（无逐文件清单）；逐文件列出仅存在于根测日志与聚焦/契约日志 | 表述略宽；证据实质不受影响（105 文件计数按构造含两契约；根测日志逐文件列出两者）。无动作必要 | — |
| N-4 | anchor 契约头注释 `:113`（承 SA2 N-5'/SA8 impl §7.1） | 注释引 probe1「实测 120 轮」，决定性证据为 probe2 240 轮 | 文件按 §11 DENY 冻结（sha 钉死），不得为注释措辞再开修订；两探针结论一致。维持登记 | SA6 未来再开契约修订时顺手更新注释指向 |

---

**审查声明**：本审查未修改任何实现、设计、测试、文档或上游 SA 产物；未运行测试或服务；唯一写入 = 本文件。`approve` 覆盖实现静态面；活链路复跑结论以 §11 动态验证项在 CI/人工合并阶段的日志为准。
