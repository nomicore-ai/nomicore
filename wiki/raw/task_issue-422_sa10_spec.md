# SA10 Spec 审查 — issue #422：hub 插件免 listen 模式（`listen: false`）与 `nomicoreHubSessionHost` 服务（spec #415 T5）

- 审查对象：最终提交 diff —— HEAD `55609d59ea86821cce39902448d415a105a993ec`（`feat(ws-replication): add hub session-only plugin mode`），父提交 = 权威 Parent PR #416 head `4ad13a35f782411d3c48096c31afa724f6eae067`（dispatch 确认稳定）。
- 基准：`wiki/raw/task_issue-422.md`（6 条 AC；Issue 评论经 REST 读取为空——无 Owner 要求）；`wiki/raw/task_issue-422_sa6_contract.md`（approve；§12.1 冻结公共面 + §12.2–§12.8 验收矩阵）；`wiki/raw/task_issue-422_design.md`（iteration 1，SA2 approve）；`wiki/raw/task_issue-422_sa3_impl.md`、`wiki/raw/task_issue-422_sa4_review.md`（approve）；`wiki/raw/task_issue-422_implementation_conflict_report.md`（clear，R1–R4 闭合）；适用规范：ADR 0032（:30/:64-66）、ADR 0023、ADR 0012、协议 `instance-replication-v1.md`（§17/§21）、`packages/ws-replication/AGENTS.md`。
- 审查方式：只读静态核验（git diff 逐 hunk、冻结声明逐字段比对、契约套件逐字节 diff、证据日志计数交叉核算）。**未修改任何产物、未运行测试、未启动服务**（SA10 纪律）。
- Verdict：**approve**（6/6 AC 全部满足；2 条 MINOR 观察不阻断）。

## 1. AC 逐条判定

| AC | 判定 | 证据 |
| --- | --- | --- |
| AC1（`listen:false` 装配成功 + `nomicoreHubSessionHost` 服务；签名 test-d 锁定） | **满足** | 分派 `plugin.ts:351-354`（严格 `=== false`）；服务发布 `:616`（唯一发布点、仅免 listen 分支可达）；`requireHubSessionHost` `:415-419`；装配+真会话回合+注入面断言 `test/ws-replication-issue422-listen-false.test.ts:193-304`（OPEN_OK 占位 sequence=0、`registry.open(HUB_OWNER, ns)` 恰一次、`bootstrapTimeoutMs:1234` 原值到达 arm 点、observer `side:'hub'`）；peer 角色同步抛 `/requires instance role "hub"/`（`:177-191`）；test-d `…issue422-session-host-api.test-d.ts` T1–T4 + 7 项 `@ts-expect-error` 负控；§12.1 冻结声明逐字段一致（`:40`/`:98-105`/`:107-118`/`:169-173` 模块增强一行/`index.ts:21,44`） |
| AC2（零 listener、零网络面） | **满足** | 免 listen 分支先于 listen 主体 return（`:468-471`），adapter 零调用（spy 断言 `:227`/`:290`）；`plugin.listener`/`plugin.replication` 恒 undefined（`:228-229`）；无 adapter 时构造不抛且装配可达（C5e/C5g② 以 `{}` overrides 构造并到达值域拒绝/ready——MINOR-2 见 §4）；NC-6 结构门（`:143-152`）对 `src/**`+`package.json` 零网络 API 命中保持绿 |
| AC3（不提供 `nomicoreHubReplication`） | **满足** | 免 listen 分支零 provide（`:525` 为 listen 分支唯一复制服务发布点）；运行时断言 `ctx.get('nomicoreHubReplication')===undefined` + `requireHubReplication` 抛 `/unavailable/`（`:232-233`）；服务成员集 = `open`/`status`/`stop`（`Object.freeze` + getter，`:606-612`），test-d 负控 `requestReauth` 不混入（test-d `:59-60`） |
| AC4（listen 模式逐字节不变） | **满足** | `test/ws-replication-plugin.test.ts` **零 diff**（git 核实）；listen 断言链 `plugin.ts:355-378` 零删除/零重排/零消息变化（diff 为纯插入）；`start()` listen 主体仅引用改名 `listenMode.*`（同值同序同消息，`:472-528` 逐表达式核对）；包全量 92 files/829 tests、根 455 files/5559 tests 全绿（`artifacts/sa3-issue422-{package-suite,root-gates}.log`）；listen 模式恒不提供 SessionHost 服务双向断言（`:170`、`:301-302`）；#418 冻结清单授权编辑 append-only（`NOMICORE_HUB_R`<`NOMICORE_HUB_S`、`requireHubRe`<`requireHubSe` 字典序成立，`:553` 区域断言形态逐字未动） |
| AC5（非法配置含拼写变体构造期响亮 TypeError，无静默降级） | **满足** | 键表/形状层构造期：NC-3 ×16 + NC-3b ×16（静默降级敏感性锚）全绿；严格 `=== false` 分派（falsy 陷阱 M1 已由 SA6 变异实证）；顶层拼写键由分派前的通用 `assertRecord` 拒绝；值域层装配期（SA2 F1 修订）：`resolveLimits/resolveTimeouts` → `validateLimits/validateTimeouts` → 分块族三链显式激活窄门（`:547-562`），与 `hub-connection.ts:76-100` 逐键逐形等价、门输入同一 `mergeNested` 对象；先于 provide（零清理）；C5d–C5g 追加块落地且经变异证据钉住（注释五校验调用 → 恰 C5d/C5e/C5g① 红，`artifacts/sa3-issue422-mutation-sensitivity.log`）；NC-5 凭据不回显由既有插件测试背书（零 diff 保持绿） |
| AC6（stop 后会话收口、timer 清零） | **满足** | `stop`：`serviceStopped` 闩锁先行 → `Promise.all(close())` → `finally { timer.dispose(); sessions.clear(); }`（`:595-603`）；幂等 `drainPromise ??=`；effect 反向 yield `[stop, revoke]`（`:614-619`）；运行时断言：stop 同一 promise、通道终态 `closed`（observer）、`status={state:'stopped',sessions:0}`、stop 后 open 响亮抛、`timer.active.size===0`、dispose 后 `requireHubSessionHost` 抛 `/unavailable/`（`:264-290`）；收口判据不依赖 `settled`（契约 C6d/E2e 口径遵守） |

## 2. 契约与规范符合性

- **SA6 §12.1 冻结公共面**：逐字段一致（常量字面量、`listen` 联合仅追加 `| false`、两接口含 doc 注释、`requireHubSessionHost` 错误消息、模块增强插入位置、index +2 值 +2 类型）。
- **SA6 §12.8 授权编辑**：冻结清单追加 2 名排序插入、零删除零重排；断言形态不变。其余既有测试逐字不变。
- **契约套件落盘**：运行时件 vs `artifacts/sa6-issue422-contract-suite/` diff = 头部 doc 注释 + `302a304,419` 纯追加（C5d–C5g，SA2 F1(4) 授权）；test-d 断言体逐字一致。冻结断言零删除零改写。零 skip/only/todo。
- **证据日志自洽**：实现前红 `8 failed | 36 passed (44)`（红因逐条 = 能力缺口 `TypeError: hub replication listen: invalid configuration`）；实现后 focused 44/44 绿（含 Type Errors none）；包全量 92/829；根 typecheck exit 0 + 根 test 5559 绿；变异敏感性 3/3 预期。`plugin.ts` md5 `379c9459…` 与 SA3 还原核验一致（变异探针无残留）。
- **规范**：ADR 0032 决策 5/:64-66 逐条兑现（显式 `false`、双轨、认证授权豁免零闭包构造、复制服务缺席、append-only 13→15）；ADR 0023 冻结服务构造（freeze+getter）；ADR 0012:13 + 协议 §17（值域响亮、窄门非追溯）；协议 §21 停机序（闩锁→drain→timer 兜底→撤销，drain 期间服务在场）；包 AGENTS（inject 四服务不变、插件只拥有台账/包装句柄/OwnedTimer/发布服务、公共导出仅经 `src/index.ts`）。
- **实现后冲突门禁**：`task_issue-422_implementation_conflict_report.md` verdict **clear**（implements ×6 / no-conflict ×16 / 零 hard-conflict/override），设计后报告 R1 ①–⑧、R2、R4 闭合，`requiresConflictRecheck=false`。

## 3. 范围与 scope creep

变更集 = `plugin.ts`/`index.ts`/2 新测试/1 授权既有测试编辑/README/CONTEXT.md + wiki 产物——全部落在设计 §11 ALLOW；DENY 全集（`hub-session-host.ts`/`hub-session.ts`/`hub-namespace.ts`/`validate.ts`/`defaults.ts`/`types.ts`/`testing.ts`/peer 侧/既有测试/`package.json`/`apps/**`/`docs/adr/**`/`docs/protocols/**`/`docs/integration/**`）经 git 核实**零 diff**。零新依赖、零新公共导出名（无未授权工厂/插件入口）、无第二套校验器（五校验器纯 import）。文档编辑严格 additive 且与代码同变更集（R2 闭合）。

## 4. MINOR 观察（非阻断，PR 披露建议）

1. **C3c 运行时 `typeof service.requestReauth === 'undefined'` 断言缺席**：契约 §12.4 单元格文字提及该运行时断言，但契约的权威可执行形态（§12.0 冻结套件）本身只携带 test-d `@ts-expect-error` 负控；交付逐字保留冻结套件。服务对象为 `Object.freeze({status, open, stop})`，结构上无该成员；类型层锁在场。属契约自身冻结形态的性质，非实现偏差。
2. **C2c 无专门冻结断言**（沿 SA4 OBS-3）：由追加块 C5e/C5g② 以 `{}` overrides 构造并到达值域拒绝/ready 传递覆盖；敏感性在场，非义务。
3. **字面 SA8 门禁产物仍缺**（契约 U1 流程记账项）：`task_issue-422_relevant_decisions.md`/`task_issue-422_conflict_report.md` 不存在；但设计后冲突门禁（clear）与实现后冲突门禁（clear）双清覆盖全部决策面，R4 已实质闭合——实现后冲突报告 §8-R4 已书面登记。
4. **R3（非阻塞）**：`docs/integration/cordis-plugin-hosting.md:179`「Hub plugin 只有在 listener 建立后才发布 ready service」在 `listen:false` 落地后仅对 listen 模式成立——本票 DENY 未改，留宿主侧后续票（设计 F4）补模式限定。

## 5. 结论

交付完整满足 Issue #422 正文全部 6 条验收标准与 SA6 契约 §12 冻结形态；无遗漏、无部分实现、无错误实现、无 scope creep；适用规范（ADR 0032/0023/0012、协议 §17/§21、包 AGENTS）逐条符合。§4 四条 MINOR 均为非阻断披露项。**approve**。
