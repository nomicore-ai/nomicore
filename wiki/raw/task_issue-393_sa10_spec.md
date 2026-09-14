# SA10 独立 Spec 审查报告 — issue #393：FileDiagnosticLog 在 registry 接缝静默半工作（自然组合零记录）

- **阶段**：spec-review（SA10，iteration 0）| **日期**：2026-09-14
- **Dispatch**：sa-5fa3c4e2-8a01-4686-97d7-00634fa0df92
- **审查对象**：最终交付提交 `9ac50599eb195224c4fcc7d1d0fef02b6c20d21c`（`fix(diagnostics): self-bind file diagnostic logs`），权威基底 = main `dcb37669e209b1aa7d50abefa208530213f147e2`；基底→头单提交 squash，diff 21 文件（生产/测试/文档 13 + wiki 产物 8），+2773/−22。
- **Verdict**：**approve**
- **输入（全部读过）**：`task_issue-393.md`（issue 正文 + Owner comment 5664521867 转录，updated 2026-09-14T13:12:42Z）；SA6 `task_issue-393_sa6_contract.md`（approve）；SA1 `task_issue-393_design.md`；SA2 `task_issue-393_sa2_review.md`（approve，O1–O4 MINOR）；SA8 `task_issue-393_design_conflict_report.md`（clear，requiresConflictRecheck=true）；SA3 `task_issue-393_sa3_impl.md`；SA4 `task_issue-393_sa4_review.md`（approve）；SA7 `task_issue-393_sa7_report.md`（approve）；4 个 SA6 契约测试文件逐行通读；最终 diff 全量逐文件；治理文本（registry/NDCL/yjs-server AGENTS、根 AGENTS 诊断日志节）。
- **独立性声明**：未采信任一上游 SA 断言为前提。全部 AC 逐条回源（issue 正文 + Owner 裁决 + 最终 diff 源码/测试全文）；P0 公式、单构造点、DENY 面零 diff、契约断言未弱化均经本轮独立 grep/diff/逐行阅读核验。本角色不运行测试（动态证据引用留盘日志 `artifacts/sa3-issue393-rerun-*.log`、`sa7-issue393-*.log` 尾部核对并标注其基准态）。

---

## 1. 验收标准逐条判定（issue 正文 8 项）

| # | 验收标准（issue 正文） | 判定 | 证据（最终 diff 锚点） |
|---|---|---|---|
| 1 | `FileDiagnosticLog` 具备 `runtimeEmitterFor`（identity 匹配本 namespace）；registry + raw log + open/mutate → segments 出现 `root-mutation` 记录——B 臂转正为正式回归测试（现红，修后绿） | ✅ | `file.ts:124-130` 接口增 required 方法成员（JSDoc 写明 identity/一切模式/纯闭包）；`:1544-1545` 构造产物闭包 `ns === namespaceId ? emitter : undefined`——与 issue P0 公式逐字一致。单构造点核验：全文件唯一 `: FileDiagnosticLog = {`（:1536）+ 唯一 `return log`（:1556），位于一切模式分支之后的形状完备返回（J6），resume 路径同物。B 臂转正 = `issue-393-ndcl-self-binding-red.test.ts` R0/R1：raw log **整对象直传** → create/release/open/`mutateData` → 有界 `setImmediate` 排空 → strict reader 回读 ≥1 条 `root-mutation` 且含 `committed`。红→绿证据：SA6 `sa6-issue393-red-contracts.log`（14 红/6 绿）→ SA3 `sa3-issue393-rerun-red-and-typecheck.log`（4 文件/22 tests 绿、Type Errors no errors、EXIT 0） |
| 2 | replication apply 路径同样落盘（runtime 级 emission 共用同一装配） | ✅ | 同文件 R2：真实 `enableReplication` + `openReplicationSession` + 合法远端 update `applyRemoteUpdate`（ok:true）→ 排空后 `replication-apply` ≥1 且含 committed；runtime/replication 包零 diff（纯环境变化——emitter 到位），与「共用同一装配」语义一致；SA7 R①-replication 独立复证（`[create, replication-enable, replication-apply]` 全 committed） |
| 3 | #150 legacy 契约测试零漂移（裸 `{emitter}` 字面量仍走 legacy 路径） | ✅ | `packages/namespace-registry/src/**` **零 diff**（本轮 `git diff --stat` 独立核验为空）→ legacy 路径逐字节结构性保持；契约 G2：裸 `{emitter: log.emitter}` 字面量恰 1 条 `namespace-create`、0 条 runtime 记录；SA7 复跑既有五套 #150/#226/#249 契约 55/55 绿（`sa7-issue393-post-removal-verify.log`，与 SA6 基线一致） |
| 4 | 其他 namespace 的 emission 不落本流（解析 undefined → 泵内丢弃，无跨 namespace 写入） | ✅ | R3：第二 ns create 前后本流记录数不变（`after === before`）；闭包对非本 ns 恒返回 `undefined`（:1545），泵 drain 内静默丢弃为既有 #226 语义；同根因的跨 ns 写入缺陷（SA6 臂 D0，计数 1→2）随之消除 |
| 5 | 无归属公共入口拒绝的落盘语义在 PR 中显式定案（接受落盘或丢弃，二选一）并写入契约测试 | ✅ | **定案 = 接受落盘**，三处显式落锤且互洽：(a) 契约 R4 头注写死定案 + 四条理由 + 边界（仅约束自绑定 per-ns log；manager 共享通道恒 `unattributed` 丢弃，#226/#228 冻结）；(b) SA6 §12.3 定案节（含「非新增行为」实测依据）；(c) P2 文档双语义边界段（cordis-host.md「The two unattributed semantics are deliberately different and not interchangeable…」）。R4 断言：泵路径判别（成员在场）+ shutdown 后 create → 恰 1 条 `REGISTRY_NOT_ACCEPTING` 且 `result.kind='rejected'`；SA7 R② 以 drain 前/后计数 1/1 复证同步共享通道语义 |
| 6 | P1：`@nomicore/yjs-server` 导出泛化 manager；app 内部改消费该导出 | ✅ | `index.ts:60-70`：导出 `createHostDiagnosticsManager` + 5 个类型（`HostDiagnosticsManager`/`…Config`/`…Deps`/`…Event`/`DiagnosticEmissionDropReason`）。泛化逐项核对：`HostDiagnosticsManagerConfig` 无 `enabled`、`retention` 单源引用 NDCL 公共 `FileRetentionConfig`；deps `{ onEvent?, now }`（`now` 保持必需，ADR-0009）；`notify` 单一收口（缺席静默、throw 吞没，ADR-0011）——grep 核实 `deps.sink` 零残留（3 处事件点全部收口）。binding/close/retire 语义 diff 逐行核对：仅 `deps.sink(...)`→`notify(...)` 三处，逻辑零漂移。app 内部消费同一实现：`app.ts:280-284` 从 `./diagnostics.js` 导入同一模块符号、`{ onEvent: this.sink, now }` 调用，`enabled` 判定保持 app 侧（:279；`config.ts` 零 diff）；index re-export 同源，无 app↔index 循环，全仓单份 |
| 7 | P2：`cordis-host.md` 配置节 + `SKILL.md` 路由落地 | ✅ | `cordis-host.md` 新增二级节「## Diagnostic change log (诊断日志)」（Process 与 Guardrails 之间）：四要素齐备——单 ns 直传正路（含 `namespaceId` 必须即目标 ns 的 SA2-O1 补句 + 「升级 ≥0.1.9 + 重启零代码改动」说明）、多 ns manager 正路（含 retire/close 生命周期）、裸 `{emitter}` = #150 legacy 陷阱（「zero errors, zero warnings」失效模式本体 + 修法是换正路而非加 observer）、Hub/Peer 组合根示例 + 两种无归属语义边界；Process 第 5 步补交叉引用。`SKILL.md` L16 路由行扩「namespace diagnostic change log (diagnostic log / observability) wiring for single- or multi-namespace hosts」+ frontmatter description 同步。P2-R1/R2 契约（文档内容契约，SA6 §12.4 已论证交付物本体即文档）转绿 |
| 8 | 根 `pnpm typecheck` 与相关包测试全绿；`namespace-diagnostic-log` 版本 bump（公共面变化） | ✅ | `package.json` 0.1.8 → 0.1.9。SA3 留盘证据（本轮尾部核对）：NDCL / yjs-server / registry 三包 `tsc -p` EXIT 0 + 根 `pnpm typecheck`（14 包链）EXIT 0；根 `pnpm test` 全量套件 **396 files / 4752 tests 全绿、Type Errors no errors、EXIT 0**（`sa3-issue393-rerun-full-suite.log`）——对照 SA6 修复前基线 `4 failed / 392 passed`、`15 failed / 4737 passed`、`Type Errors 1 failed`，失败面恰为本票 4 契约且全部转绿、既有 392 文件零回归。SA7 post-removal 复跑 9 文件/77 tests 绿佐证无临时夹具依赖 |

## 2. Owner 裁决落实（comment 5664521867，2026-09-14T13:12:42Z，dispatch 交办面）

dispatch 交办的 Owner 硬性要求：「direct `createFileDiagnosticLog(...)` → `diagnosticLog` is supported and must be repaired through **FileDiagnosticLog identity self-binding**；**no configuration-blame or fail-fast type-tightening substitute is acceptable**」。逐条判定：

| Owner 要求 | 判定 | 证据 |
|---|---|---|
| 自然组合（两个公共导出的直接组合）必须直接工作；不工作 = 产品 bug，非配置错误 | ✅ | 修复本体即 adapter 自绑定（`file.ts:1544-1545`）；主契约载体 = raw log 整对象直传（R1/R2），不以「正确 manager binding」充当主路径；全部 diff 无一丝「Host 配置错误」定性措辞，P2 文档把直传写为单 ns **正路**（P0 后完整语义） |
| 修复必须经 `FileDiagnosticLog` identity 自绑定（`runtimeEmitterFor` = `ns === this.namespaceId ? emitter : undefined`） | ✅ | 实现公式与 Owner 表述逐字一致；registry 探测逻辑零改动（DENY 面 `packages/namespace-registry/src/**` 空 diff，独立核验）——成员在场即经既有非抛探测（`typeof === 'function'`）路由入 #226 泵路径，非任何旁路机制 |
| 不接受 fail-fast 类型收紧替代 | ✅ | 全 diff 无类型收紧面：registry seam 类型（`types.ts`）零 diff；无任何对 raw log/legacy 形状的编译期或运行期拒绝新增；4 契约文件通读复核无任何类型拒绝断言；裸 `{emitter}` 仅弱化为文档陷阱（P2「The bare `{emitter}` trap」），行为冻结 |
| 不接受 configuration-blame | ✅ | issue 定性（产品缺陷）贯穿设计/实现/文档；DSH 现有接线被明示「零代码改动即正路」（文档单 ns 段：「An existing direct-pass wiring needs no Host code change: upgrade … and restart」） |
| 不加 `initStream`（P0 形状纪律） | ✅ | 无该成员新增；契约双守卫（registry G3 / NDCL G1）锚定缺席；泵侧缺席 no-op 为既有语义 |
| P1 降级为多 ns Host 正路（导出泛化 manager，app 消费同一实现，全仓一份） | ✅ | 见 §1-AC6；签名泛化三要素（去 `enabled`、`onEvent?`/`now`、retention 单源）逐项在场 |
| P2 skill 文档（单 ns / 多 ns / 裸 `{emitter}` 陷阱 / Hub·Peer 示例 + 路由） | ✅ | 见 §1-AC7 |
| AC5 无归属拒绝显式定案入契约测试 | ✅ | 见 §1-AC5（接受落盘，三方文本互洽） |

## 3. SA6 验收契约核对（§12.1–§12.5 完成门禁）

- **契约文件保真**：4 个契约文件随交付提交入仓，本轮逐行通读并与 SA6 §12 表逐条比对——用例集（registry R0–R4/G1–G4；NDCL R1–R3/G1/G2 + 类型面 R/G；app P1-R1…R4/P2-R1/R2）与断言面**零弱化**：全部运行时断言读 strict reader 落盘 record / onEvent 事件回调 / 公共入口动态 import，无 skip/only/todo，无源码字符串断言（P2 例外有 SA6 §12.4 论证）；R4 头注定案文本在案。红灯真实性独立佐证：`sa6-issue393-red-contracts.log` 尾部 14 failed/6 passed 与契约分类一致，且契约文件红灯基线（SA6 全量套件 4 failed 全部为本票）先于实现存在。
- **守卫锚**：G1–G4、NDCL G1/G2、类型面 G 全部保持绿（SA3/SA7 留盘）——断言非恒红/恒绿。
- **§12.5 门禁**：15 红 → 0；#150/#155/#226/#228/#249 既有契约零漂移（五套 55/55 复跑 + registry/runtime/replication 零 diff）；根 typecheck 与全量套件绿；版本 bump 落盘——逐项闭合（§1-AC8）。
- **§12.3 AC5 定案**：实现侧零新代码（同步共享通道既有），契约 R4 + P1-R2 双语义边界各守一族，与定案互补不冲突的 SA8 裁定一致。
- **§15 备案形态**：`runtimeEmitterFor` 声明为 required（设计 D1 选择），满足契约类型面 optional 目标形态（`surface.test-d.ts:20` 条件类型求值 true 由 `Type Errors no errors` 佐证）；disabled/failed 统一 identity 解析（备案形态二选一之「返回 silent emitter」），JSDoc 记载观察面等价性——未发明第三种形状，无需回 SA6 对齐。

## 4. 规范与冻结面（SA8 裁定实现兑现复核）

- SA8 §5 冻结面 10 项逐项对 diff 核验：seam 成员名零新增（逐字复用 `runtimeEmitterFor`）；registry 探测/三态路由/legacy 逐字节零 diff；record schema/manifest/reader/retention/health/memory adapter/`docs/adr/**`/`CONTEXT.md`/NDCL `src/index.ts`/`config.ts`/`lifecycle.ts` **全部零 diff**（本轮独立 `git diff --stat` 覆盖核验）；stdout NDJSON 事件词表零变更（P1 事件类型化 = 既有形状）；NDCL 环境绑定面零新增（纯闭包成员）。
- SA8 `requiresConflictRecheck=true` 的待闭合面（公共 API 变化兑现、R4/P1-R2 双语义边界、冻结面承诺）已由 SA4 §8-b 六项清单逐项核对通过，SA4 判定无新 ADR 冲突风险、不再提交 conflict recheck——本轮对同一 diff 的独立复核结论一致，无遗留冲突面。

## 5. Scope creep 与文件范围

- 交付 diff 生产/测试/文档面 = 设计 §11 ALLOW 9 项 + SA6 4 契约文件（AC1 明文要求的「转正入仓」），逐一对应、零无理由扩张；wiki 产物 8 份随提交入仓（仓内 1456 份 tracked wiki 先例，交付惯例）。
- 无夹带：无 registry/runtime 改动、无 schema/格式/wire 变化、无新依赖、无 memory adapter 自绑定（显式非目标 R5 保持）、无 `diag-pump-drop` 管道改动（issue 明文独立处理，未伪装解决）。
- 两个适配的 app 测试 diff 逐行核对：仅调用形状（`enabled` 删除、`sink`→`onEvent`），零断言改动。

## 6. 必须披露的未达成/ deferred 项（PR 披露义务；均不构成本票 AC 缺口）

| # | 项 | 定性 | 授权链 |
|---|---|---|---|
| D1 | **DSH 两部署（Hub nomicore-host / Peer mabf-runner）零代码改动恢复**：仓外部署事实（升级 NDCL ≥0.1.9 tarball + 重启后 segments 恢复记录），本 worktree 不可证 | 仓外验收项，须由部署方/发布说明披露 | issue 正文「下个 tarball 批次 + 重启」；设计 §13-R6；SA3 Deferred；SA4 §10-1；SA7 环境边界——五方一致诚实标记 |
| D2 | **yjs-server 版本未随新公共导出 bump**：`createHostDiagnosticsManager` + 5 类型为新增公共面，本票仅 NDCL bump（0.1.9） | 发布评审裁决项，非 AC 缺口（AC 仅强制 NDCL） | 设计 §12/§13-R7；SA2 O3；SA4 O1——三方一致备案 |
| D3 | **`diag-pump-drop` 生产 Host 观测管道缺口**（plugin 不传 observer 时满队丢弃不可见） | issue 明文弱化、独立处理的 follow-up，不在本票 | issue 正文 P2 段附记；设计 §13-R4 |
| D4 | **memory adapter 无自绑定**（直传仍走 legacy）；**已构造 Runtime 不回溯补挂**（升级须重启生效） | 显式非目标 | 设计 §1 非目标 / §13-R5/R6；SA6 §15 备案 |
| D5 | 验证证据 log（`artifacts/sa3/sa6/sa7-issue393-*.log`）未随提交入仓（worktree 未跟踪原样保留） | 证据留存方式差异——仓内 64 份 tracked artifacts 存在先例；wiki 报告链已入仓承载结论 | SA4 O2 同款观察（红灯归因由 SA6 修复前基线独立承载）；非 AC 面 |

## 7. Non-blocking observations（MINOR，不阻断 approve）

- **O1（文档微瑕，承 SA4 O3）**：`cordis-host.md` Hub/Peer 组合根示例中 Peer 片段用 manager 而非单 ns 直传——与「Peer 复制一或多远端 ns」的多 ns 倾向自洽，单 ns Peer 直传未单独示例；语义已由上文覆盖，无行为影响。
- **O2（证据固化建议，承 SA4 O2）**：SA3 因果反转核验（stash P0 hunk → 5 红/4 绿 → pop 逐字节恢复）仅存于报告记载、未固化 `artifacts/sa3-*.log`；红灯归因已由 SA6 修复前基线独立承载，不影响 verdict。
- **O3（NDCL 0.1.9 vs 0.2.0，承 SA2 O3）**：required 成员加入公共接口在严格 semver 下属 implementor-breaking；仓内惯例 patch 位递增（0.1.7→0.1.8 先例），AC 仅要求 bump——0.1.9 可接受，0.2.0 取舍留发布评审（与 D2 一并定案）。

## 8. Verdict

**approve**

- 8 项 AC 全部满足（§1），无一 partial/unmet/unachievable；Owner comment 5664521867 的硬性裁决（identity 自绑定修复、registry 零改动、拒绝 fail-fast 类型收紧与 configuration-blame 替代）逐字兑现（§2）。
- SA6 契约 15 红 → 0 全绿且断言零弱化，守卫锚保持，完成门禁（根 typecheck + 全量套件 396/4752 + 版本 bump）逐项闭合（§3）。
- 冻结面零漂移经独立 diff 核验；SA8 recheck 待闭合面已由 SA4 核对通过（§4）。
- 无 scope creep（§5）；未达成项 D1–D5 全部有授权链、属仓外/发布/follow-up 面，须在 PR 中披露（§6）；3 条 MINOR 不阻断（§7）。
