# SA4 实现静态审查 — issue #437：lease 端到端数组逐元素校验行为钉死（ADR 0033）

- 角色：SA4（Red Team，iteration 0）
- 审查对象：SA3 实现 = SA6 冻结三件套 + 探针的原样采纳 + 5 份门禁证据日志 + 实现报告
  （`wiki/raw/task_issue-437_sa3_impl.md`）
- 审查基线：worktree `mabf/issue-437` @ HEAD `02c7cfb`（含 #435 `006e416`、#436 `f61e583`）
- 审查方式：静态审查（源码锚点逐一对读、md5 逐件复核、证据日志逐行核对、git 只读命令）；
  未运行测试、未启动服务、未修改任何实现/设计/测试/证据件

---

## 1. Reviewed inputs

| 输入 | 存在性 | 备注 |
|---|---|---|
| `wiki/raw/task_issue-437.md`（任务简报） | ✓ | issue 正文 AC1–AC6；Comments 节空；Blocked by #436 |
| `wiki/raw/task_issue-437_design.md`（SA1 设计） | ✓ | 354 行；ALLOW/DENY、§7.6 采纳政策、§9 门禁映射 |
| `wiki/raw/task_issue-437_sa2_review.md`（SA2 评审） | ✓ | verdict approve；无 BLOCKER/MAJOR；4 MINOR 观察（O-1..O-4） |
| `wiki/raw/task_issue-437_sa3_impl.md`（SA3 实现报告） | ✓ | 本次审查对象；声明原样采纳 + 5 证据日志 |
| `wiki/raw/task_issue-437_sa6_contract.md`（SA6 契约） | ✓ | approve；冻结指纹 §16、门禁清单 §13 |
| `wiki/raw/task_issue-437_sa6_capability_probe.mts`（探针） | ✓ | md5 `3b647b42…` 复核一致 |
| 冻结三件套（契约/负控/夹具） | ✓ | md5 三件复核一致（见 §2） |
| `task_issue-437_relevant_decisions.md` / `_conflict_report.md` / `_design_conflict_report.md` | ✗（不存在） | iteration 0 无 SA8 工件；设计 §6/SA3 输入表如实声明 |
| Owner comments | ✗（REST issue-comment read `[]`；与 dispatch 上下文一致） | 无 owner comment 需求面 |
| 源码/ADR/AGENTS/既有测试/artifacts 日志 | ✓ | SA4 直接读取核验（§4–§9） |
| 既有 `wiki/raw/task_issue-437_sa4_review.md` | ✗（首次落位） | 本文件为首次实现评审产物 |

## 2. Verdict

**approve**。无 BLOCKER、无 MAJOR。

核心判定（全部经 SA4 独立复核，非转述 SA3 声明）：

1. **采纳忠实性成立**：冻结四件（契约/负控/夹具/探针）md5 逐件与本 worktree 文件一致
   （`62de8c31…` / `34f50039…` / `9fa5995f…` / `3b647b42…`），与 SA6 契约 §16 冻结值
   逐字相同 ⇒ SA3「原样采纳、未改写、未重排、未软化断言」的声明属实（设计 §7.6 第 1/3 条落实）。
2. **生产零改动成立**：`git diff`（tracked 面）为空；`git diff --name-only` 对
   `packages/*/src`、`apps`、`domains`、`vitest.config.ts`、`tsconfig*.json`、`package.json`、
   `packages/*/package.json` 全空；untracked 面无任何 `src/` 文件（`git ls-files --others`
   过滤复核）——issue 正文「本 ticket 不改实现」与设计 §1.2/§10 DENY 全部未被触碰。
3. **证据有效性成立**：5 份 `artifacts/sa3-issue437-*.log` 逐份与 SA3 报告 §Verification
   声称值一致（聚焦 20/20 + `FOCUSED_EXIT:0`、探针 32/32 `failures=0` + `PROBE_EXIT:0`、
   根 typecheck `TYPECHECK_EXIT:0`、宽 tsc `WIDE_TSC_EXIT:0`、根 test 466 files/5667 tests
   全绿 + `ROOT_TEST_EXIT:0`）；两新文件被真实收集的行号引用（SA3 报告 L378/L584；
   SA6 契约 L377/L646 属另一日志）均逐行核实命中。
4. **测试完整性成立**：契约 13 `it()` + 负控 7 `it()` 与设计 §7.2 冻结矩阵逐条对应
   （AC1-a..e、AC2-a/b/d/c、AC4-a/b、AC5-a/b；C1–C7）；零 `.skip/.only/.todo/.each`、
   零 `process.env`、零 `setTimeout`、零源码字符串断言、零吞错 catch（唯一 `try` 为
   读计数包装的 try/finally 复位）；断言期望值与现行实现源文逐字一致（见 §4）。
5. **判别敏感性成立**（非恒真）：SA6 基线证据在位且红集精确 = AC1-a..e + AC2-d
   （baseline-focused.log FAIL 行逐条核对；3 轮稳定各 6 红）；HEAD 5 轮稳定性日志全
   20/20；探针 A/B（P1e/P1f、P5a/P5b：fast=0 vs legacy=191）独立通道在案。

3 条 MINOR 观察不阻断（§12）；静态无法闭环的运行风险列入 §11 交由 Controller 路由。

## 3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
|---|---|---|
| issue AC1：污染数组 array-delete 照常成功；触达面外非法数据不被普通写发现 | 契约 AC1-a..e（`issue-437-lease-array-e2e-contract.test.ts:59-143`）：值污染/载体非法/字段值非法/批量信封五形态，`ok:true` + 污染保留逐值断言；写前 `readData` 可见性前置断言证污染在场；负控 C1 同污染 union 腿响亮拒绝（反证） | 落实。五形态覆盖 issue 措辞的「元素载体/值非法」两面 + insert/delete 两 op + 批量信封；「不被发现」以污染保留 + union 反证双向钉死 |
| issue AC2：非法新元素零写入 + issue 路径 `[...arrayPath, index+j]` 不变 | AC2-a（`:149-180`）：`['items',2]/['items',3]`（index+j）+ 嵌套 `['rows',1,'qty']` + 零写入零 update | 落实。index+j 语义（合法首值 8 跳过、x/y 逐个 +j）与 `mutation-local.ts:361` `[...mutation.path, index+i]` 源码一致 |
| issue AC2：越界拒绝语义不变 | AC2-b（`:182-200`）：越界 message 逐字 + path + 零写入零 update | 落实。期望文与 `mutation.ts:820/829` 源文逐字一致（`array-insert index 越界（不 clamp）`、`array-delete 范围越界（不 clamp、不接受越界 no-op）`） |
| issue AC2：空批量 noop 不变 | AC2-c（`:225-252`）：`values:[]`/`count:0`/`{ops:[]}` 三形态信封形状门拒绝 + 零写入零 update | 落实。措辞歧义按设计 §7.5 定案（lease seam 可观察事实 = 形状拒绝不变；恒等 accept 归 #435 B6——该文件在位复核）；期望文与 `mutation.ts:256/649/654` 源文逐字一致（单操作 prefix='' ⇒ 逐字节同） |
| issue AC3：union 数组目标端到端行为与性能路径不变（仍全量边界校验） | 负控 C1–C3（仲裁 message 逐字 `联合成员 1/2：类型不匹配：期望 number，实际 boolean` 与 `validate.ts:529` label + `:203` 模板源文一致；干净写；issue path `['uarr',1]`）+ C7（legacy 读计数 ≥n）+ AC2-d 同规模对照腿 | 落实。行为逐字 + 结构性性能锚（读计数 ∝n = 全量 walk 仍在）双面钉死 |
| issue AC4：诊断 committed update bytes 记录形态不变 | AC4-a/b（`:258-313`）：`root-mutation`/`transaction`/`committed effect:update` + inline carrier 键集（`base64,crc32c,format,payloadLength,storage`）+ 同基态重放收敛 + 空 doc 不物化（反整文档编码）+ 数组写 vs 标量写记录/carrier 键集逐键同构 | 落实。形态三面（键集/真增量重放/空 doc 反证）+ 同构对照，非仅值相等 |
| issue AC5：fast path 提交经 replication apply 对端收敛、无协议面变化 | AC5-a/b + C6：三通道（纯 Y.Doc 同基态重放 / peer `applyRemoteUpdate` / `encodeDiff` 定点）+ 最小增量形态（空 doc 不物化 ROOT）+ 每提交恰一事件（二次写再恰一）+ session 状态面（`open`/`hub-to-peer`/`localRole`/`remoteInstanceId`） | 落实。收敛非租约读路径自证；session 状态期望与 `replication-session.ts:424-428` 派生逻辑一致；线级烟测明示票外（ADR 0033 协议零改动） |
| issue AC6：根 `pnpm typecheck` 与 `pnpm test` 绿 | `artifacts/sa3-issue437-root-typecheck.log`（`TYPECHECK_EXIT:0`）+ `artifacts/sa3-issue437-root-test.log`（466/5667 全绿、`ROOT_TEST_EXIT:0`、L378/L584 两文件被收集） | 落实。`pnpm test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`（根 package.json:11 复核）；宽 tsc（`tsconfig.typecheck.json` 含 `packages/*/test/**/*.ts`）另证 exit 0 |
| issue 正文「不改实现、只立法」 | `git diff` 空 + untracked 无 src 文件（§2.2） | 落实 |
| SA2 O-1（设计 §7.7 理由表述与 package.json 事实不符） | SA3 报告 §SA2 Finding 落实表：在本报告更正理由（registry 确实依赖 `@nomicore/namespace-diagnostic-log`，`package.json:27` 复核属实）；实践本身与既有惯例一致——SA4 复核 5 处实锚全部命中：`registry-create-diagnostic-red.test.ts:95`、`registry-issue-249-pump-red.test.ts:67`、`issue-393-ndcl-self-binding-red.test.ts:59`、`registry-issue-226-red.test.ts:66`、`diag-pump-scheduler-injection.test.ts:3` | 落实。按 SA2 建议位置（实现 notes）更正，不动三件套（md5 不变），符合设计 §7.6 第 3 条 |
| SA2 O-2/O-3/O-4 | SA3 报告同表：O-2 记录声明序差异不改文件；O-3 措辞更正记录于报告；O-4 探针本轮复跑 exit 0 | 落实。均不要求改三件套；处置与 SA2 建议一致 |
| SA6 契约 B-1..B-7 绑定 | 三件套断言面逐条对应（B-1 lease seam、B-2 `applyRemoteUpdate` 注入、B-3/B-4/B-5/B-6/B-7 各组） | 落实。契约纪律（§12.4）逐项复核通过（§8 测试质量审查） |

## 4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
|---|---|---|---|
| §7.1 最高 seam = lease `mutateData`/`readData`（Registry testing seam 装配） | 三件套全部用例只经 `lease.mutateData/readData` + `session.applyRemoteUpdate`；装配 = `createNamespaceRegistryForTesting` + `createRegistryTestScheduler`（`testing.ts:86/126` 实锚复核）+ 固定 clock + 计数 randomBytes | 一致。`lease.ts:392-394`（mutateData 透传）/`:330-331`（readData 透传）锚点属实——lease 确为判别联合最终形状面 | 无 |
| §7.2 冻结矩阵（13 + 7） | 契约文件实数 13 `it()`、负控 7 `it()`，组名/断言要点逐条对应 | 一致。AC2 声明序 a/b/d/c 与矩阵 a/b/c/d 的差异 = SA2 O-2 已定案（独立夹具、零语义差） | 无 |
| §7.2 fixture 边界（数据四形状/装置面/助手面） | `issue-437-lease-array-e2e-fixture.ts`：`SCHEMA_437` 四形状（items/rows/uarr/n）、最小 persistence stub（`createDoc/loadDoc/saveDoc/importDoc`）、`HUB_CLIENT_ID=4242`、`applyRawRemote`（对端固定 `REMOTE_CLIENT_ID` 求增量经 `session.applyRemoteUpdate`）、`countElementReadsAsync`、`settleUntil`、诊断助手 | 一致。stub 契约成员与 `DocPersistence` 面吻合（宽 tsc exit 0 背书）；污染只经 replication apply，`doc` 引用仅基态/oracle/装置面（live 值断言一律经 `lease.readData`——三件套全文复核） | 无 |
| §7.3 判别组（A/B 闸门对照 + 规模对照 + 独立通道 + 旧实现基线） | AC1 组（非 union 快轨）× C1（union 同污染拒绝）；AC2-d（fast ≤8）× C7（legacy ≥n=64）；探针 P1e/P1f/P5a/P5b（32/32，`sa3-issue437-probe.log` + `sa6-issue437-probe.log` 双份在位）；基线 6 红/14 绿 ×3 轮（`sa6-issue437-baseline-*.log`，FAIL 行 = AC1-a..e + AC2-d 逐条核对） | 一致。四层敏感性证据齐备且 SA4 逐项复核数值（fast=0/legacy=191；基线红因逐字 `类型不匹配：期望 number，实际 string` + `127 > 8`） | 无 |
| §7.4 读计数结构代理（窗口覆盖整个 `mutateData` await + finally 复位） | `countElementReadsAsync`（fixture:413-448）：实例包装 `get`（+1）/`toArray`/`forEach`（+length）、`await run()` 后 `finally delete`；与 `write.ts:187`（判定在 sequencer 槽内 await 之后）时序论证一致 | 一致。实例属性赋值遮蔽 + delete 复位（prototype 方法回归），零残留；F2 用 `.length` 属性不经被计三方法（`mutation-local.ts` F2 注释互证） | 无 |
| §7.5 空批量定案 | AC2-c 三形态形状拒绝（message 逐字 vs `mutation.ts:256/649/654`；单操作 `parseMutationCore(input,'',…)` prefix='' 复核） | 一致 | 无 |
| §7.6 采纳政策（原样采纳/门禁复跑/红灯上报） | md5 四件不变；5 门禁证据日志在位且数值一致；本轮无红灯（HEAD 20/20） | 一致。第 4 条（红灯=生产回归信号）未触发 | 无 |
| §7.7 装置纪律 | sweep 复核：零 skip/only/todo/env/setTimeout/源码字符串断言/吞错 catch；fixture 零 vitest 依赖（本地 `assert` + `setImmediate`）；clientID 三方固定；远端污染一律 insert 新元素（`applyRawRemote` 全部 mutate 回调复核：仅 `.insert(0,[…])`） | 一致 | 无 |
| §9 验证映射（聚焦/探针/根 typecheck/宽 tsc/根 test） | 5 份 `sa3-issue437-*.log` 逐份核对（§2.3） | 一致 | 无 |
| §8 数据流三路线（L1 污染/L2 lease 写/L3 对端收敛）只读观察 + 显式注入 | 三件套装置与断言面一一对应（L1 `applyRawRemote`+写前可见性；L2 判别联合+零 update 锚；L3 三通道+diff 定点） | 一致 | 无 |
| 生产接口/状态机/数据流零变化 | `git diff` 空 | 一致 | 无 |

## 5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
|---|---|---|---|
| 行为立法观察入口 | lease seam（用户可见判别联合） | 全部经 `lease.mutateData/readData` | 正确 |
| AC4/AC5 装配 | registry（runtime/lease/session/诊断 host 级 owner，registry AGENTS.md） | fixture 经 registry testing seam + `createBoundedMemoryDiagnosticLog` 公共面 | 正确。无 `src/index.ts` 外新公共 API；测试控制全经显式 `/testing` 面 |
| 污染注入 | replication trusted raw 面 | 仅 `session.applyRemoteUpdate`（`replication-session.ts:491+` 锚点属实） | 正确。不直写 live doc |
| 诊断观察 | diagnostic-log 公共 index | `../../namespace-diagnostic-log/src/index.js`（公共面，非 subpath） | 正确 |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
|---|---|---|---|---|
| vfsl/doc-runtime 立法 | `issue-435-*` / `issue-436-*` | 不触碰、不重复（git 无改动） | 一致 | 切面正交；census（A2–A4 清单）与在位文件核对一致 |
| registry 测试装配惯例 | `createNamespaceRegistryForTesting`（既有 50 文件主流） | fixture 同款 | 一致 | 无平行通道 |
| 诊断相对源引用惯例 | 5 处既有实锚（见 §3 O-1 行） | fixture 同款 | 一致 | 引公共 index；宽 tsc + 根测试双绿背书 |
| fixture 共享装置惯例 | `issue-389-change-subscription-t3-fixture.ts`（`.js` 后缀 import） | `./issue-437-lease-array-e2e-fixture.js` 同款 | 一致 | 两侧测试 + 探针共用单一装置 |
| 读计数结构代理 | #436 `countElementReads` | `countElementReadsAsync`（窗口扩至 await 后时序） | 一致且有据 | `write.ts:187` 时序论证 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 行为期望值 | 冻结常量（域 message/path、union 仲裁 message、carrier 键集）——SA4 逐字对源核验一致 | 无第二份推导 | 低——红灯即契约变化信号，走 ADR 修订（设计 §12），无静默同步机制 |
| 收敛/增量形态 | 机制性 oracle（重放/空 doc/diff 定点/A-B） | 无 | 低 |
| 污染在场性 | live doc（经 `readData`）+ union 反证 | 无 marker/镜像 | 低 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| 每测试独立 fixture（registry/lease/session/诊断） | 测试进程退出（无显式 close；受控 fake scheduler 零真实 timer；与包内主流惯例一致——SA2 S-6 已核 50 文件仅 5 显式 close） | 夹具 `assert` throw 即红（fail-loud） | 可接受。无泄漏面：零网络/零长驻进程/零真实计时器；根 test 全绿 466/5667 背书 |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
|---|---|---|---|
| 第二断言库/评论读取路径/cleanup worker/API wrapper | 无 | 无新增 | 无平行。fixture 本地 `assert` 是探针共用装置的有意分层（零 vitest 依赖），非平行通道 |
| 探针 yjs 直取 | fixture/registry 内 yjs | `packages/namespace-registry/node_modules/yjs/dist/yjs.mjs`（symlink 归一） | 可接受（SA2 O-4 已登记；本轮复跑 exit 0） |

## 6. 文件范围审查

只读 git 命令核对（SA4 未 checkout/revert/修改任何文件）：

| Changed path | ALLOW entry | Purpose | Assessment |
|---|---|---|---|
| `packages/namespace-registry/test/issue-437-lease-array-e2e-contract.test.ts`（untracked） | 设计 §10 ALLOW（采纳冻结件） | AC1/AC2/AC4/AC5 契约 13 tests | 合规。md5 与冻结值一致 |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-control.test.ts`（untracked） | 同上 | C1–C7 负控 7 tests | 合规。md5 一致 |
| `packages/namespace-registry/test/issue-437-lease-array-e2e-fixture.ts`（untracked） | 同上 | 共享装置（非测试入口） | 合规。md5 一致；非 `*.test.ts` 不入发现面（`vitest.config.ts` include 复核） |
| `wiki/raw/task_issue-437_sa6_capability_probe.mts`（untracked） | 同上（探针证据通道） | 独立验证通道 | 合规。md5 一致 |
| `wiki/raw/task_issue-437{,_design,_sa2_review,_sa3_impl,_sa6_contract}.md`（untracked） | §10 ALLOW `wiki/raw/` 证据面 + 各角色固定产物位 | 任务工件 | 合规 |
| `artifacts/sa6-issue437-*.log` ×17（untracked） | §10 ALLOW（保留已在位） | SA6 证据 | 合规 |
| `artifacts/sa3-issue437-{focused,probe,root-typecheck,wide-typecheck,root-test}.log` ×5（untracked） | §10 ALLOW「`artifacts/sa3-issue437-*.log`（实现阶段新增）」 | 实现阶段门禁证据 | 合规。沿 #436 `sa3-issue436-*` 命名先例 |
| `wiki/raw/task_issue-437_sa4_review.md`（本文件，新增） | SA4 技能固定产物位（同 §10 `wiki/raw/` 证据面惯例） | 实现评审 | 合规 |

**DENY LIST 核对**：`git diff`（tracked）为空；`git diff --name-only` 对
`packages/doc-runtime/src`、`packages/vfsl/src`+`issue-435` 测试、`packages/namespace-runtime/src`、
`packages/namespace-registry/src`、`packages/namespace-diagnostic-log/src`、`issue-436` 测试、
`packages/ws-replication`、`apps/yjs-server`、`packages/replication-protocol`、`docs/adr`、
`CONTEXT.md`、`docs/protocols`、`vitest.config.ts`、`tsconfig*.json`、`packages/*/tsconfig.json`、
`packages/*/package.json`、`pnpm-lock.yaml`、registry 既有测试——**全部无输出**。
untracked 面无 `src/` 文件。ALLOW 未修改路径：`wiki/raw/task_issue-437_design.md`（SA2
O-1/O-3 的更正按 SA2 建议落在实现 notes，设计文件未动——与 §7.6 第 3 条「修改三件套须重
冻结」不冲突，因为未修改三件套）。清理面：`.worktrees/` 空、无 `zz-issue437-debug.test.ts`
残留、`git worktree list` 仅主仓 + 任务 worktree（`sa6-issue437-cleanup-check.log` 复核一致）。

## 7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
|---|---|---|---|---|
| 生产 API（lease/runtime/session/诊断/持久化） | 一切经 lease 的业务写/读、复制对端、诊断消费方 | 零变化（`git diff` 空）——无 caller 需要迁移 | 无 | 无 |
| 根 vitest 发现面（`packages/*/test/**/*.test.ts`） | CI `ci.yml`（主 job 全量 `vitest run --typecheck.only` + 根 `pnpm test`） | 两新文件匹配 glob；实测被收集（sa3 root-test L378/L584、sa6 post-root-test L377/L646 双日志）并被 CI 主 job 隐式覆盖 | 无 | 无 |
| 宽 typecheck（`tsconfig.typecheck.json` 含 `packages/*/test/**/*.ts`） | 根宽 tsc 命令 | 三新文件入类型检查，`WIDE_TSC_EXIT:0` 零噪声 | 无 | 无 |
| registry 包级 typecheck（tsconfig 只含 `src/**`） | `pnpm --filter`/根 typecheck 链 | 测试面由 vitest 收集 + 宽 tsc 覆盖（registry `tsconfig.json` 复核只含 `src/**`）——与包内既有测试同待遇 | 无 | 无 |
| fixture 对 persistence 契约（`DocPersistence`） | stub 实现 | `createDoc/loadDoc/saveDoc/importDoc` 满足 `importReplica` 唯一必需复制导入能力；类型面宽 tsc 背书 | 无 | 无 |
| 探针 → fixture（`.ts` 直引，tsx 运行） | 证据通道 | 共用装置 ⇒ 独立通道而非复制粘贴；本轮 exit 0 | 低（依赖布局敏感 = SA2 O-4 已登记） | 无 |
| 未来演进（改闸门/域规则/诊断 carrier/复制增量者） | 本票服务对象 | 判别组或不变量组红灯显形（基线 6 红/14 绿实测可显形性） | 这是目的 | 无 |

## 8. 错误、恢复与并发

| 检查面 | 复核结果 |
|---|---|
| 静默失败/伪装成功 | 无。`issueOf` 先断言 `ok===false` 再取 issues（缺 issues 会在 `.map` 处 throw）；夹具 `assert` throw 即红；无 `catch` 吞错（唯一 `try` 为读计数 try/finally 复位） |
| 拒绝路径诚实报告 | AC2-a/b/c、C1、C3：拒绝后 `readData` 复读原值 + `ownedUpdates.length===0` 双锚 |
| 读计数窗口漏计 | `countElementReadsAsync` 覆盖整个 `mutateData` await 窗口（与 `write.ts:187` sequencer 槽内 await 后执行的时序一致）；finally 复位零残留；5 轮稳定性实测 |
| 拒绝零 update 断言窗口 | `flushMicrotasks(24)` > 泵投递延迟 `FANOUT_DELIVERY_DEFERRAL_MICROTASKS = 20`（`replication-session.ts:195` 复核）——写入若泄漏，入队发生在 `mutateData` await 内（同步 `doc.on('update')` 观察者），24 轮内必达断言前。静态闭环；对票外未来改动该常数的敏感性见 §12 O-B |
| 恰一提交/无重复扇出 | AC5-b 二次写再恰一 + C5/C6 对照；`waitForOwnedUpdates` 有界 setImmediate 沉降后精确等值 |
| 并发项不确定合并 | 远端污染一律 insert 新元素（全部 mutate 回调仅 `.insert(0,[…])` 复核）；clientID 三方固定（4242/4243/999999） |
| 测试间互扰 | 每 test 独立 fixture（独立 persistence/registry/scheduler/doc）；根配置 `maxWorkers: 1`（`vitest.config.ts:17`） |
| 环境不确定性 | 零随机源（计数 randomBytes 只服务 128-bit 且 throw 其它长度）、固定 clock、零真实 timer、零网络 |
| 进程/资源收敛 | 无服务/后台进程；fake scheduler；根 test 408.52s 单轮收敛（日志复核） |

## 9. 测试质量审查

SA4 未运行测试；以下为测试源码与真实触发入口的静态审查（数值证据取自在位日志并逐份核对）。

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
|---|---|---|---|---|
| AC1-a | 值污染 + delete → `{ok:true}`、污染保留 `['oops',1,3,4,5]`、恰一 owned update；写前污染可见 | 根 `pnpm test` / 聚焦 vitest（均实跑，日志在位） | 无。主路径行为断言（非错误分支专用）；基线红（`ok:false`+`['items',0]`） | 无 |
| AC1-b | 值污染 + insert（合法新值）→ `{ok:true}`、污染零修复 `['oops',1,9,2,3,4,5]`、恰一 update | 同上 | 无 | 无 |
| AC1-c/d | 载体非法（裸 number）/字段值非法（`qty:'x'`）+ delete → `{ok:true}`、写前可见、值保持 | 同上 | 无 | 无 |
| AC1-e | 批量信封 `{ops:[delete]}` 污染数组照常 ok + 恰一 update | 同上 | 无 | 无 |
| AC2-a | 非法新元素整笔零写入 + index+j 路径 + 嵌套路径 + 零 update | 同上 | 无。合法首值跳过语义（8 过、x/y 拒）确证 +j 逐值 | 无 |
| AC2-b | 越界 message/path 逐字 + 零写入零 update | 同上 | 无。期望文与源文逐字一致 | 无 |
| AC2-d | fast 读计数 ≤8（n=64）且 union legacy ≥n 且 legacy>fast | 同上 | 无。机器无关计数、方向即断言；基线 127>8 红 | 无 |
| AC2-c | 空载荷三形态形状拒绝逐字 + 零写入零 update | 同上 | 无。措辞歧义按 §7.5 定案立法（lease seam 可观察事实） | 无 |
| AC4-a | 记录分类 + carrier 键集/格式/crc/payloadLength + 同基态重放收敛 + 空 doc 不物化 | 同上 | 无。`records.length===1` 精确计数为有意形态冻结（§12 O-C） | 无 |
| AC4-b | 数组写 vs 标量写 record/carrier 键集逐键同构 | 同上 | 无 | 无 |
| AC5-a | 三通道收敛 + diff 定点 + session 状态面四元组 | 同上 | 无。状态期望与 `replication-session.ts:424-428` 派生一致 | 无 |
| AC5-b | 增量形态（空 doc 不物化）+ 同基态重放 + 二次写再恰一 | 同上 | 无 | 无 |
| C1–C3 | union 轨 legacy 逐字判决（同污染反证）+ 干净写 + issue path | 同上 | 无。A/B 对照腿使 AC1 判别非恒真 | 无 |
| C4–C6 | 域规则不 clamp（两轨）+ 单事件提交 + 批量单事务单事件 | 同上 | 无 | 无 |
| C7 | union legacy 读计数 ∝n（≥64） | 同上 | 无。AC3「性能路径不变」结构锚 | 无 |

发现面真实性：两 `*.test.ts` 匹配 `vitest.config.ts` include `packages/*/test/**/*.test.ts`；
根 `pnpm test` 日志含两文件 run 行（13/7 tests）；CI `ci.yml` 主 job 全量跑同 include——新
测试被 CI 真实触发。无 `*.test-d.ts` 新增（本票无类型测试需求；宽 tsc 已覆盖测试源类型面）。
fixture 非 `*.test.ts`，不入发现面（设计意图）。负控/突变敏感性：旧实现基线 6 红（判别组）
+ 14 绿（不变量/负控）的分裂本身就是测试敏感性证明（同一夹具在 pre-#436 实现上于目标断言
处响亮失败）。

## 10. Required revisions

无 BLOCKER / MAJOR finding。空表。

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

## 11. 后续动态验证项

静态审查无法闭环、交由 Controller 路由的运行风险（不指定角色）：

| Risk | Driver | Expected observation | Failure condition |
|---|---|---|---|
| 判别组在旧实现上的红/绿归因依赖 SA6 期证据（SA3 未复跑基线；设计 §9 未列为实现门禁） | 在 `7407ce0` detached worktree（方法学 = SA6 §4/§7：worktree + `pnpm install --offline` + 同一聚焦命令）复跑冻结两文件 | 6 failed / 14 passed；红集 = AC1-a..e + AC2-d；红因逐字 = legacy 全量判决 + `127 > 8` | 红集漂移或判别组变绿（恒真化信号：闸门/夹具/入口被环境因素改变） |
| 聚焦套件稳定性轮（SA3 单轮 20/20；SA6 5 轮） | 最终环境连跑聚焦套件 ≥3 轮 | 每轮 20/20 绿 | 任一轮红（时序敏感信号：沉降窗口/泵延迟/fake scheduler 假设被打破） |
| CI 首跑（新文件在 CI 矩阵的真实触发） | push 后 CI 主 job | 两文件被收集（13+7）且全量绿 | CI 环境下红/未被收集 |
| 探针依赖布局（SA2 O-4 承接） | 复跑 `task_issue-437_sa6_capability_probe.mts` | 32/32、exit 0 | yjs 直取路径失效（依赖布局变化——先查布局再定性） |
| 根门禁在合并基线上的复证（并行合入漂移） | 最终 merge 基线上复跑根 `pnpm typecheck` + `pnpm test` | 双 exit 0、两文件仍被收集（计数按设计 §9 注不钉绝对值） | 非本票原因的第 4 方回归掩盖/干扰判读 |

## 12. Non-blocking observations

- **O-A（MINOR，AC1 污染恒在触达区间外）**：AC1-a..e 的污染元素一律位于被删/被插区间
  之外（`items[0]`/`rows[0]` 污染，delete/insert 作用于 index≥2）。这与 AC 措辞（「对被
  污染的数组做 array-delete 照常成功」「触达面外不被发现」）及设计 §7.2 冻结矩阵一致，
  是有意的最小可判定装置；「删除污染元素本体」的形态（按 ADR 0033 也应 `ok:true`）在
  lease seam 未单独立法。不阻断：属可选扩展面，非验收缺口。
- **O-B（MINOR，拒绝零 update 断言窗口与生产常量的隐式耦合）**：`flushMicrotasks(24)`
  覆盖现行 `FANOUT_DELIVERY_DEFERRAL_MICROTASKS = 20`（`replication-session.ts:195`）；
  若未来（票外）生产侧抬高该常数，拒绝路径的零 update 断言理论上可能漏检迟到的泄漏
  事件。静态审查下现行值闭环且正向用例另用 200 轮 setImmediate 沉降；仅登记敏感性，
  不要求本轮动作。
- **O-C（MINOR，AC4-a 精确计数断言）**：`records.length === 1` 把「同操作多记录」也判红
  ——这是 AC4「记录形态不变」的有意冻结（额外记录即形态漂移信号），非脆性缺陷；红灯
  时应走形态变化判定而非改断言。
- **O-D（MINOR，SA3 未复跑基线与多轮稳定性）**：SA3 按设计 §9 门禁清单执行（基线复跑
  与 5 轮稳定性不在实现阶段门禁内），依赖 SA6 在位证据；已列入 §11 动态验证项，非实现
  缺陷。

## 13. 结论

SA3 的实现 = 对 SA6 冻结三件套 + 探针的**逐字节忠实采纳**（md5 四件复核一致）+ 完整门禁
证据链（5 份日志逐份数值核对一致、行号引用精确命中）+ 报告与实物零偏差。生产零改动
约束以 tracked diff 空 + untracked 无 src 双面证实；文件范围严格落在设计 §10 ALLOW 内、
DENY 全部未触碰；测试完整性（零 skip/only/todo/env/源码字符串断言/吞错、断言期望与源文
逐字一致、主路径与错误分支双触发、真实入口发现 + CI 覆盖）与判别敏感性（基线 6 红/14 绿
×3 轮 + HEAD 20/20 ×5 轮 + 探针独立通道 32/32）均有在位证据且经 SA4 独立复核。SA2 的
4 条 MINOR 观察全部按建议位置落实（报告内更正，三件套不动）。无阻断 finding；
**verdict = approve**。本审查未发现新的 ADR 冲突风险（不需要冲突复查）。
