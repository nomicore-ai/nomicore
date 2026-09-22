# SA4 实现红队评审 — issue #420：SessionHost 公共工厂 + 内存管道完整协议回合（spec #415 T3）

- 派工（iteration 0，implementation-review）：`sa-4aac664b-5533-4b6c-a3d1-b8481d57d71b`
- 派工（iteration 1，implementation-review）：`sa-4d29edc8-7c00-45a1-9661-e3b7bbb6b498`（role `mabf-sa4`，phase implementation-review，iteration 1）——评审对象 = **SA3 iteration 1 finalization-repair 证据归并变更**（交付提交 `a315e70` 之后工作区遗留证据集的 C1 归一化 + 归档补齐 + 证据日志），原位更新本文件
- 派工（CI 修复轮，implementation-review，iteration 0）：`sa-d6246063-c71b-4fb0-b63b-3596ea314825`（role `mabf-sa4`，phase implementation-review，iteration 0）——评审对象 = **SA3 iteration 4 CI 红灯最小修复**（PR #429 head `3f470fb` 上两个父侧 #423 测试文件的 D9 符号名机械跟随），原位更新本文件（Part C）
- 派工（CI 修复轮复审，implementation-review，本产品当前轮）：`sa-7bf71e86-9988-43e6-ba1e-891995d05495`（role `mabf-sa4`，phase implementation-review，iteration 1）——评审对象 = **已提交的 CI 修复（commit `2c87b3b`）+ 其诊断与全部验证证据**（SA3 7 条已提交日志 + SA6 CI 修复轮未提交契约/证据 + 远端 CI/PR 状态独立复核），重点 = 实现正确性与测试遮蔽缺失；原位更新本文件（Part D）
- 评审对象与基线：
  - iteration 0：worktree `/home/wangjian/nomicore-fix-issue-420`（branch `mabf/issue-420`，基线 HEAD `7039f6d…`）上的 SA3 未提交实现 + TDD/验证证据；该实现已由 Controller 以 `a315e70`（`feat(ws-replication): expose session host factory`，父 `7039f6d`）承载提交
  - iteration 1：交付提交 `a315e70` 之后工作区的 18 条候选路径（2 tracked-modified + 16 untracked，本轮 `git status --porcelain -uall` 亲验 = 恰这 18 条，无其它改动）
  - CI 修复轮：HEAD `3f470fb`（= PR #429 head，四 commit：`4e5ff0a` 交付 + 三条归档）之上的工作区改动 = 恰 3 条 tracked-modified（两 #423 测试文件 + SA3 报告）+ 7 条 untracked 证据日志（`git status` 亲验，与 SA3 报告 10 条 staging 清单恰同集合）
- 评审方式：静态开卷（源码 + diff + 测试源码 + 证据日志逐项核对 + 独立 sha256/C1/blob-identity 复算）；SA4 不运行测试、不修改实现/设计/测试。唯一可写产物 = 本文件
- Owner 评论：无（历轮派工均明文 none；REST comments = `[]`——与 SA6 §2/SA8/SA1/SA2/SA3 五方同口径；CI 修复轮同样无逐条评论映射可建，与 SA3 报告口径一致）

---

## 2. Verdict

### CI 修复轮复审（committed `2c87b3b` / PR #429 已 merge）：**`approve`**（0 × BLOCKER；0 × MAJOR；Part C 遗留 O14–O16 维持非阻断，新增 2 条 MINOR 非阻断观察 O17–O18；Part C 唯一待办——Deviation #6 范围扩展的 SA8 复认——**已闭合**，见 §D-6）

核心判断（本轮对**已提交态与远端态**全部独立复核，非采信任何自述）：

1. **诊断正确且根因唯一——远端与本机双定证**。红灯 run `35663498235`（head `3f470fb`，`gh run view` 亲取 conclusion=failure）恰 5 作业红：typecheck（4 条 TS2724/TS2305 逐字指向两 #423 文件的 `../src/hub-session.js` 旧符号导入）+ `test (20|24, 1|6)`（同文件 `TypeError: (0 , createHubSessionHost) is not a function`），其余 11 作业全绿 ⇒ 归因面唯一。SA6 单变量对照实验（`run-red-prefix.sh`）在修复 head `5a4049d` 上仅把两消费方文件换回 `3f470fb` 字节（sha256 锚 + SWAP_OK 亲读）即逐字复现 4 × TS 错误 + 8 × TypeError（三个 exit 码 2/2/1），恢复后 SHA256_IDENTICAL 且 tracked 树净——因果链闭合。机制探针 9/9 PASS（旧名 `typeof undefined`、内部导出面恰 `['createHubSessionSink']`、公共工厂在场且与内部 splice **distinct**——修复绑定的是内部 splice 而非被改道公共工厂）。
2. **修复正确——谱系与类型同一性亲证**。`25c51cd:hub-session.ts:42` 原文 `export type HubSessionHost = HubSessionSink`（别名）且 `:300` `createHubSessionHost` 即同一内部 splice；HEAD `hub-session.ts:299` 唯一运行时导出 `createHubSessionSink`、`HubSessionSink` 接口权威面在 `hub-split.ts:126`。修复的导入形态（工厂自 `hub-session.js`、类型自 `hub-split.js`）与权威消费方 `src/hub-connection.ts:18` 逐形相同；类型标注 `HubSessionHost`→`HubSessionSink` 经别名链**语义同一**。`git diff 3f470fb HEAD` 亲验：`packages/ws-replication/src`、`package.json`、`.github`、`docs`、`CONTEXT.md` **零字节**。
3. **无测试遮蔽——四重独立证明**。① diff census：`git diff 25c51cd HEAD -- 两文件` 剔除注释后恰 6 行代码改动（2 导入 + 2 类型标注 + 2 工厂调用），断言/用例体/选择器零字节变化；② 用例数守恒：`it(`/`test(` 计数 5→5 与 21→21；③ 抑制标记零命中（`skip|only|todo|fails|concurrent` grep RC=1）；④ **变异敏感负控**（`run-mutation-sensitivity.sh`）：对 `hub-session.ts` 语义单点突变（`accounting` 直通置 `undefined`）后两修复文件 5 用例转红（MUTATION_FOCUSED_EXIT=1），恢复 sha256 验证——修复后的测试仍绑定真实运行时行为，绝非空转。
4. **验证证据链在远端闭合——gh 三点独立亲证**。① 修复后 CI run `35665953800` head `5a4049d` conclusion=success，16/16 作业全绿（typecheck + 12 分片 + contract-gates/codegen-freshness/packaging）；② PR #429 state=MERGED（merge `4ad13a35`，parents `25c51cd`+`5a4049d`），且 merge commit tree 与 `5a4049d` tree **同一**（`187cc70f…` 双取相同）⇒ PR head 绿完全覆盖合并态；③ 合并 commit 本身另有绿 run `35666189272`。SA3 已提交日志（focused 26/26、包全量 90/785、`--typecheck.only` 49/270、分片 1/6=63/820、6/6=67/831 逐字绿、契约锚 5 文件/89 用例绿）与 SA6 head 侧五门（`00-green-gates-driver.log` DRIVER_EXIT=0）自洽。
5. **REST 评论口径复核**：issue #420 与 PR #429 的 issue/review comments 均 `[]`（`10-rest-comments-snapshot.log` + 本轮 `gh` 亲取一致）——「Owner comment requirements: none」成立，无遗漏的 Owner 要求面。

**本轮不提交 `requiresConflictRecheck`**：修复零决策文本/ADR/协议触碰；Part C 登记的范围扩展已由 SA8 CI 修复轮裁决收编（`implements-existing-decision`，见 §D-6），无未决 ADR 冲突面。

### CI 修复轮（SA3 iteration 4 / PR #429 `3f470fb`）：**`approve`**（0 × BLOCKER；0 × MAJOR；新增 3 条 MINOR 非阻断观察 O14–O16，见 §C-12；一处**范围扩展**由 SA3 以 Deviation #6 + `requiresConflictRecheck: true` 显式登记待 SA8 复认，非静默越界——**该复认已于 SA8 CI 修复轮闭合，见 §D-6**；其余判定依据见 §C-6）

核心判断（本轮全部独立复核，非采信自述；三问 = 正确性 / TDD 证据 / 测试遮蔽面）：

1. **符号映射正确——亲证**。父基 `25c51cd` 的 `hub-session.ts` 导出面 = `createHubSessionHost` / `HubSessionHostConfig` / `type HubSessionHost = HubSessionSink`（`git show 25c51cd:…` 亲取）；当前树 = `createHubSessionSink` / `HubSessionSinkConfig`（唯一运行时导出，#418 冻结锚 `…structure.test.ts:618` `toEqual(['createHubSessionSink'])` 亲证在场），`HubSessionSink` 接口在 `hub-split.ts:126`。修复的导入形态（工厂自 `hub-session.js`、类型自 `hub-split.js`）与仓内权威消费方**逐形相同**：`src/hub-connection.ts:18`、`src/hub-session.ts:23` 自身、`test/…issue418-…-structure.test.ts:39`、`test/issue420-shim-hub.ts:66-68`。fixture 传参七字段与 `HubSessionSinkConfig`（`hub-session.ts:32-41`）逐一吻合；`host.*` 全部用法（`openNamespace`/`namespaceFrame`/`channels`/`dataFacetOf`）均在 `HubSessionSink` 接口面上。
2. **TDD 红→绿证据链自洽且可复核——亲证**。红 = CI run `35663498235`（5 fail：typecheck 4 条 TS2724/TS2305 逐字指向两文件旧导入 + 两分片 3+5 用例同 `TypeError`；其余 11 作业全绿 ⇒ 归因面唯一）+ 本地独立复现（同 4 条 TS 错误 EXIT=2；`Tests 8 failed | 750 passed (758)`）；绿 = V29–V35（两文件 26/26、包全量 90 文件/785 用例、`--typecheck.only` 49/270、CI 分片命令**逐字**重跑 1/6=63 文件/820 与 6/6=67 文件/831、契约锚 5 文件/89 用例）。内部一致性三重核对：26 = 修复前 8 红 + 18 绿（用例数守恒）；分片文件数与 CI 失败态 63/67 恰合；包测试目录实测恰 90 文件 = SA8 RA2' 预期 87 + #423 三文件。V30/V33/V34 与 `.github/workflows/ci.yml:39/:44/:78-80` **逐字同命令**（亲验）。9 枚 sha256 冻结锚（2 测试文件 + 7 证据日志）与报告登记值**逐一相同**（亲算）；两文件 mtime 06:41:06 < 日志 06:45:07（亲验）⇒ 验证绑定在冻结代码态上。
3. **无测试遮蔽——亲证**。`git diff` 全集 = 每文件 +5 行头注 + 2 导入行 + 1 类型标注 + 1 工厂调用（18 insertions / 8 deletions），**断言 / `it`/`describe` 名 / 选择器 / 阈值零字节变化**（changed-lines grep 0 命中）；零 skip/only/todo/xit（grep exit 1）；fixture **未**改指向公共 `createHubSessionHost`（其 `HubSessionHostConfig` 吃 transport，签名不同形）——仍以 stub port 直驱内部 splice，测试意图（缝另一侧打桩、驱动内部半边）原样保留；CI 触发性由失败事实本身 + 分片脚本同源枚举（`scripts/ci-test-shard.mjs:25` 与 vitest include 同口径）双重证明。
4. **零生产字节、零冻结面触碰——亲证**。`git diff -- packages/ws-replication/src/` 空；`docs/`、`CONTEXT.md`、协议文本、`src/index.ts`、SA6 §12.1 冻结签名、#418 冻结导出表、7 文件 listen 矩阵全部零改动（`git status` 全集亲验）。全仓 grep：重命名前旧符号的 stale 消费方**恰为这两文件**（第三 #423 文件不 import `hub-session.js`；shim-hub 用的是公共工厂自 `hub-session-host.js`，正确；#418 契约测试的 `'createHubSessionHost'` 是公共导出清单冻结条目，正确）。

**本轮不提交 `requiresConflictRecheck`**：修复零决策文本/ADR/协议触碰，无新的 ADR 冲突面；文件范围扩展属 SA8 复认域，SA3 已自带 `requiresConflictRecheck: true`（Deviation #6）请求该复认，SA4 不重复占用同一通道。

### iteration 1（finalization repair）：**`approve`**（0 × BLOCKER；0 × MAJOR；新增 6 条 MINOR 非阻断观察 O8–O13，见 §B-10/§B-12；iteration 0 遗留 O1–O7 状态见 §B-12 尾）

核心判断（本轮全部独立复核，非采信自述）：

1. **零业务面字节变化——亲证**。13 条 ALLOW 路径（设计 §11）`git hash-object` vs `git ls-tree HEAD` **13/13 IDENTICAL**；`git diff HEAD --stat -- packages docs CONTEXT.md .editorconfig vitest.config.ts package.json` **空**。交付语义与 `a315e70` 逐字节相同。
2. **归一化仅空白且当前态 C1 全清——亲证**。18 条候选路径逐一扫描：trailing-ws=0、CR=0、末字节恰一 LF（前一字节均为内容字节，即无 EOF 空行）；tracked diff `git diff --check` RC=0。被归一化行号抽查（M2 :37/:52/:67/:82/:97/:124/:139/:154 现为 `    269|` 无尾随空白；sa6-runner :22/:34/:46/:82 现为 `      5|`/`      4|` 无尾随空白）与 gate 诊断的 `{WS}` 行形态逐一吻合。
3. **哈希声明全部对上——亲证**。SA3 报告 iteration-1 表格的 16 个 after sha256[:16] 与当前文件逐一相同；`artifacts/sa3-issue420-evidence-reconcile.log` 全量 sha256 = `4f893393b9fba731b8d843666472abb9d0eda554d17114d811abf884b2b0d2fe`、53056 B / 656 行，与报告声明全同；§7.3 全量 sha256 表与实测前缀逐一相符。
4. **生命周期零副作用——亲证**。真实 index 未被写（`git diff --cached --stat` 空 = index ≡ HEAD）；`git reflog` HEAD@{0} = `a315e70`（交付后无任何 commit）；无 push。SA3 只写了 13 条归一化路径 + 证据日志 + 其报告的 iteration-1 节，与 §7.1 声明一致。
5. **引用完备性（SA9 §10-M3 闭合判据）独立复现成立**。本轮对 HEAD 六份交付报告 grep 全部 `issue420` artifact 引用并逐条解析：全部为「committed at HEAD」或「本轮 18 条 staging set」；唯一不在场的 `artifacts/sa6-issue420-smoke.mts` 在 SA6 契约 §16（HEAD :413）明文登记为已删除临时脚本（非证据缺口）。SA9 §10-M3 列举的未跟踪路径清单（mutation ×7 + design-letter-divergence + red-contract + sa6-runner-trigger-red + sa7 两日志 + 任务简报 = 13 条）与被 C1 归一化的 13 条路径**恰好同一集合**；3 条零改动补档（SA9/SA10 终审 + SA8 iteration-6 报告）符合 #418/#419/#421 交付归档先例。
6. **无 hash registry 破坏——亲证**。HEAD 六份 420 报告 40/64-hex 扫描仅命中基线 commit OID `7039f6d…`（空白归一化不可触及），无任何 artifact sha256 注册被改写。

**iteration 1 未引入新的 ADR 冲突面**（决策文本、ADR、CONTEXT 零字节变化），本轮不提交 `requiresConflictRecheck`；iteration 0 评审曾提交的 ADR 0032 附录 A2 β 措辞对齐问题已由 HEAD 上的 SA8 implementation 复查（iteration 0 裁决表行 4/5/11，`implements-existing-decision`）裁决闭合；当前在册的 `requiresConflictRecheck: true`（SA8 implementation 冲突报告 iteration 6，窄域 = rebase 后公共 API 并集面未落树）是 Controller 拥有的 rebase 门，与本轮证据归并无涉（见 §B-12-O11）。

### iteration 0（原 verdict，维持）：**`approve`**（0 × BLOCKER；0 × MAJOR；6 × MINOR 非阻断观察 O1–O7）

核心判断（含派工点名的 **design-letter divergence**，SA3 报告 Deviation 1）：

1. **载体提交（carrier commit）偏离设计 §7 D7 字面是证据驱动、最小面、契约优先的正确取舍，不构成 MAJOR。** 设计 D7 `namespaceFrame` 行的字面机制（routing 相位非 OPEN 帧入 pending 窗口、路由完成后冲刷）与**冻结 AC3 硬门不相容**：`ws-replication-ac7-faults.test.ts:29-53`（SA3 报告引用 :32-56）在授权门闩悬挂期注入 UPDATE 并**在 `release()` 之前**断言 wire 出现 `NAMESPACE_STATE_VIOLATION`；字面机制把投递推迟到结算之后 ⇒ 该用例必红。SA3 以 `artifacts/sa3-issue420-design-letter-divergence.log` 实证（`Tests 2 failed | 51 passed`，红项正是该用例 + 反空跑），随后落地的替代机制（相位 `routing` 的非 OPEN 帧立即提交 `denialSink` = 生产 splice + 真 port；OPEN 帧仍走分支 ② 有界 pending 窗口）满足逐字节一致纪律。**iteration 0 独立源码重放证实其等价性论据**：listen 形态下此类帧到达的是首 OPEN 到达点已建成的生产通道（`hub-session.ts:83-93` 同步建 + `startOpen`），由通道自身状态机判定违例（`hub-namespace.ts:839-851`：'opening' 非 accepted ⇒ `sendNsError('NAMESPACE_STATE_VIOLATION')` + `finalize('failed')`，**ns 级 ERROR 非连接 fatal**）；载体提交复用的是**同一生产机械同一 port**，违例帧在同一到达形态下被同一 FSM 判定。入窗 OPEN 条目随提交丢弃与 listen 同构（`finalize` 不应答 openWaiters——亲读 :1676-1694，waiters 悬置即「静默丢弃」）。夹具仍零协议决策（不合成应答、不选错误码、无 FSM）；不触公共冻结签名/DENY 面/port 17 成员集/验收语义；改动面限 ALLOW LIST 既有夹具文件。已按 skill「实现必要偏离设计 ⇒ 记录证据 + 建议路由」由 SA3 报告 Deviation 1 + 夹具头注双登记，提请 SA8 implementation 复查裁决——**回流目标 = design（D7 `namespaceFrame` 行文本修订）+ SA8 impl 复查**，不需要返工实现。该裁决已由 HEAD 上 SA8 iteration 0 复查作出（`implements-existing-decision` + RA1'' 设计文本补正登记）；设计 §7 D7 文本本身尚未修订 ⇒ SA4-O1 维持在册（非阻断）。
2. **冻结面全部逐字落地**：`hub-session-host.ts` 公共声明与 SA6 §12.1 逐字段一致（逐成员比对，含 JSDoc 语义；adapterPort 17 成员与 D5 表逐行对齐）；`hub-namespace.ts`/`hub-edge.ts`/`src/testing.ts`/协议文本/7 矩阵文件/`package.json` 零 diff；`index.ts` append-only 恰 +1 值 + 7 类型。
3. **TDD/验证证据自洽且可复核**：红（V1 8×TS2305 + TS2307、V2 3 files failed）→ 绿（V3 63/63、V4 80 files/651 tests、V6 根 typecheck、V7 根 443/5381）与基线（77/588）增量吻合（+3 文件/+63 = 588+63）；变异 M2/M3/M4/M5/M7/M7b 实跑红、M1 内建红臂 A12 按设计 §12 落地；矩阵断言体零编辑（文件零 diff）。

---

# Part A — iteration 0 实现评审（原位保留；实现字节 = HEAD `a315e70`，本轮 13/13 blob 身份复核后继续成立）

## A-3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| Issue 正文：导出 SessionHost 公共工厂，`open()` 输入含六字段（connectionKey/remoteInstanceId/namespaceId/authorization 预授权投影/selectedCapabilities/可选 connectionId） | `src/hub-session-host.ts:55-89`（逐字 SA6 §12.1）+ `src/index.ts` 追加导出；test-d 正控逐字段 `toEqualTypeOf` | 落实 |
| Issue 正文：句柄 `handleFrame`（fire-and-forget）/`onFrame`（出帧，sequence=0 占位）/`close` | `:119-171`；占位编码留在内部 sink（`hub-session.ts:256-262`），listener 收到的帧占位 0（round A8/C4c 断言）；`close` 幂等（sink closeTail 单 promise） | 落实 |
| Issue 正文：authorize 不在 session 侧调用——闭包回放预授权投影 | adapterPort `openAdmission` 恒 `Promise.resolve({outcome:'authorized', authorization: input.authorization})`（`:178-182`）；test-d 负控禁 `authorize`/`transport`/`port` 键 | 落实 |
| Issue 正文：内存管道对驱动完整协议回合，无 socket 无 worker | round 测试 A1–A12 全绿（V3）；`makeWire` 内存双端；零跨线程面 API（grep 0 命中，C4a 结构门） | 落实 |
| AC1 test-d 锁定 + 导出恰增一名 | V3（63 tests + Type Errors 0）+ V5（tsc 绿，负控全触发无 TS2578）+ `FROZEN_PRODUCTION_EXPORTS` +`'createHubSessionHost'` 字母序单行插入 | 落实 |
| AC2 OPEN→bootstrap→live→reconcile→CLOSE 完整回合 | A4–A9 逐项（OPEN_OK 恰一 + authorize 恰一次、快照/ACK 回指、SYNC 族 + doc 收敛、双向 UPDATE/ACK + 零 resync、CLOSE_OK 回指 + settled 恰一） | 落实 |
| AC3 矩阵 shim 重跑 + 通道零改动 + 状态机零 fork | 机制 (a)：`vi.mock` 仅替换 `createHubReplication` + 动态 import 7 文件（断言体零编辑，diff 亲证）；`hub-namespace.ts` 零 diff；V4 651 全绿含 shim 臂 53 | 落实（D7 字面机制偏离见 §A-4/§2——登记回流，不弱化 AC） |
| AC4 缝两侧只过 Uint8Array 与纯 JSON；零 worker 依赖/类型 | C4a（src+package.json 0 命中）/C4b（structuredClone + JSON 往返 + DataCloneError 负控）/C4c（字节 + 占位/wire 序）/C4d（无 live 对象） | 落实 |
| AC5 session 侧零重检入站 sequence | C5a（回退序 2 经 `handleFrame` 仍被消费 + `CLOSE_OK{ackedSequence:2}` + 零 fatal）/C5b（edge 单点负控）/C5c（结构门 0 命中）/C5d=M5（变异 9 红，含 C5a/C5c） | 落实 |
| SA2-F1（已解决项）三分支路由 | `HostBridge.openNamespace`：① authorized → 句柄转发不重调 `open()`（`reopenForwarded`）；② routing → OPEN 入有界 pending 按到达序同步冲刷（`pendingFlushed`）；③ denied → `denialSink.openNamespace`；矩阵 `:212`/`:240` 两用例 shim 臂断言逐字不变绿；M7/M7b 变异分别使两用例红（V9/V10） | 落实 |
| SA2 N1'（closed 守卫下挂起 terminate 的归宿） | `routeAdmission` `finally → settleTerminateWaiters`：closed/续体异常 → no-op resolve；denied → denialSink；authorized → 句柄 | 落实（夹具 :341-353/:397-415） |
| SA2 N2'（冲刷须在续体同一同步段） | `flushAuthorized`/`flushDenied` 在相位置位后同步调用、无 await 间隔；头注登记不变量；M7b 反证 | 落实 |
| SA2 N3'（Map 键模板笔误） | 键 = `` `${connectionKey}\u0000${namespaceId}` ``（`hub-session-host.ts:248`） | 落实 |
| SA8 RA1'（附录 + CONTEXT 同变更集） | ADR 0032 澄清附录 +23 行（A1 信号词汇/A2 三载体/A3 dormant+U8）+ `CONTEXT.md:229-231` 词条 + _Avoid_ 一项 | 落实（对齐风险见 §2/A-12-O1，SA8 iter-0 已裁决） |
| SA8 RA2'（deny 断言族 + W2 修正负控） | 矩阵 shim 臂 deny 族绿；round A4-W2：PEER_OWNER → 零 OPEN_OK + `NAMESPACE_NOT_FOUND` + 注册表零成功打开 + authorize 恰一次 | 落实 |
| SA8 RA3'（零 diff/导出恰增/S2 有界/observer 单点/反空跑/M1–M7/重命名纯机械） | 逐项独立复核全部成立（见 §A-5–§A-7、§A-9） | 落实 |
| SA8 RA6'(i)–(vi) | (i) 三分支 + 相位单调 + E10 try/catch + closed 守卫在夹具落地；(ii) 两用例 shim 臂绿；(iii) 两 suite 均有 unhandled 哨兵（round A11 + matrix afterAll）；(iv) `sessionsOpened` 断言在 clean 回合 = 1（多连接角见 §A-12-O3）；(v) M7 实跑登记；(vi) R11/R12 头注登记（夹具 :38-45） | 落实 |
| SA6 §12.6 两处授权编辑 | contract 测试 +1 行零删除零重排；structure 测试 7 行机械跟随（`:551` 全等断言形态不变） | 落实（diff 逐行核对） |

## A-4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| D1 新模块 + 冻结面（逐字 SA6 §12.1）+ 内部复用 splice + 响亮前置 | `hub-session-host.ts` 全文；`open()` 前置 throw（空 connectionKey / 重复 (connectionKey, ns)）；`createHubSessionSink({port: adapterPort,…})` 单份组装 | 逐字段一致；公共名经 splice 重命名让出（D9） | — |
| D2 `handleFrame`：解码无 `expectedSequence`、capability 透传、OPEN→`openNamespace`、连接级/方向域静默、其余→`namespaceFrame(message, header.sequence)` | `:119-148`；switch 显式列名静默集合（HELLO/HELLO_ACK/OPEN_OK/BOOTSTRAP_SNAPSHOT/IDENTITY_CHANGED/GOAWAY），default→`namespaceFrame` | 与内部分派壳净行为等价（未知 kind 经内部 default 静默）；解码失败 → `connection-fatal{code ?? MALFORMED_FRAME}`（E2 fail-loud） | — |
| D3 `onFrame`：至多一 sink、后注册替换、退订置空、无 sink ⇒ 0、throw 同步传播、lane 区分 | `:150-155`/`:215-219`（`deliverFrame` 直接调用 listener） | 落实；占位 0 + 返回序承重由 A8/A12/M1 锚定 | — |
| D4 信号面：`settled` 恰一次经通道单调性、`connection-fatal` 丢 `wsCloseCode` 只发 code、`close`/`terminateUnauthorized` 委托 sink | `:164-171`/`:221-235`；桥侧 `settled → realPort.onChannelSettled`、`connection-fatal → realPort.connectionFatal(code)` | 落实；等价论据成立（通道仅两点恒 1002，重验 `hub-namespace.ts:662,1099`） | — |
| D5 adapterPort 17 成员映射 | `makePort()`（`:175-210`）逐一对照 D5 表：`dataGateOpen` 恒 true、`bufferedAmount` 恒 undefined、assembly per-session 单槽（`size>=1` 拒纳）、`emitObserver`=`dispatchReplicationObserver` 单点复用、`now` observer 门控 + `safeNow`、`connectionState` 两态投影 | 17/17 对齐；`HubSessionEdgePort` 成员集零增删（`hub-split.ts` diff 仅头注） | — |
| D6 U3 = edge 侧处置（denialSink = 生产 sink 直连真 port） | 夹具 `:217-226`/`:387-393`；denied/throw 续体投递 `denial.openNamespace` | 落实；drain 簿记（denied 终态 → 真 port `onChannelSettled`）保真 | — |
| **D7 宿主桥：三分支路由 + 有界 pending + 路由续体 E10 + closed 守卫 + terminate 相位挂起** | `HostBridge`（`:248-353`/`:357-476`） | **除一处已登记偏离外全部落实**：`namespaceFrame` 相位 `routing` 的**非 OPEN** 帧不走 pending 窗口（设计字面）而走**载体提交**（`commitToProduction`，`:316-327`）；OPEN 帧仍按分支 ② 入窗（SA2-F1 原样） | **SA4-O1（MINOR，登记回流）**：证据 = `sa3-issue420-design-letter-divergence.log`；等价性源码重放证实；SA8 iter-0 复查已裁 `implements-existing-decision`；设计 §7 D7 文本待 SA1 补正 |
| D7 续体：closed 守卫先查、`route.phase !== 'routing'` 次查、`finally` 收口 terminate 挂起 | `:357-400` | 落实（双守卫次序正确；E10 catch → `connectionFatal('INTERNAL_ERROR', 1011)`） | — |
| D7 pending 有界：≤16 帧/ns + 单帧 ≤ maxFrameBytes + 溢出 1008 响亮 | `enqueue`（`:464-476`）+ `MAX_PENDING_FRAMES=16` | 落实（镜像 `hub-connection.ts:54` 先例）；矩阵全程 `pendingOverflow===0` 断言在场 | — |
| D7 shim hub 服务面 + 早到帧有界缓冲 + auth timer | `ShimHubImpl`（`:527-729`）；`installEarlyFrameAdmission` 镜像 | 落实；门链保真度差异清单 + R11 + R7 按头注登记 | — |
| D8 机制 (a)：`vi.mock` 仅替换 `createHubReplication` + 动态 import + 末位反空跑 | `ws-replication-issue420-shim-matrix.test.ts`；夹具仅深路径 import（逐 import 核对：`../src/*.js`，零包入口引用） | 落实；`maxWorkers:1` + 按文件隔离 ⇒ mock 无跨文件泄漏 | — |
| D9 重命名（5 文件机械） | `hub-session.ts`/`hub-connection.ts`/`hub-split.ts`（仅头注）/#418 两测试 | 纯机械（diff 逐行）；`docs/**`/`CONTEXT.md` 对旧名零残留引用 | — |
| D10 RA1 文本（E1/E2 线 + dormant/U8） | ADR 附录 A1/A2/A3 + CONTEXT 词条 | 落实；A2 β 措辞对齐缺口已由 SA8 iter-0 裁决登记 | — |

## A-5. 架构一致性与惯例

### 责任归属

| Behavior | Expected owner | Actual location | Assessment |
| --- | --- | --- | --- |
| 协议 FSM（含重开矩阵/违例判定） | `hub-namespace.ts`（零 diff） | 零 diff 通道；公共工厂与夹具均注入消费 | ✓ |
| 连接级纪律/序分配/close code 映射 | 真 edge | `createHubReplicationEdge` + `wsCloseCodeFor` 单点 | ✓ |
| authorize 唯一真实调用 | edge 台账 | `beginAdmission` 恰一次（台账首建）；桥/公共面只消费结局 | ✓ |
| 拒绝路径 wire 行为 | 生产代码 | denialSink（生产 splice + 真 port） | ✓ |
| 路由相位（装配状态） | test 夹具 | `HostBridge.routes` | ✓（非协议 FSM；头注明示） |

### 相似能力对照

| Similar capability | Existing implementation | Actual implementation | Consistent or divergent | Reason |
| --- | --- | --- | --- | --- |
| session 半边组装 | 内部 splice（`createHubSessionSink`） | 公共工厂内部复用同一 splice（第二种 port 形态） | 一致 | 单份组装代码 |
| 早到/在途有界缓冲 | `MAX_EARLY_FRAMES=16` + 1008/1009 拒绝（`hub-connection.ts:54`） | pending 窗口同界同族收口 | 一致 | 同码同界镜像 |
| 拒绝路径承载 | `hub-namespace.ts:346-376` 生产通道 | denialSink 直连真 port | 一致 | 决策 1 分布式实例化 |
| observer 隔离/时钟折叠 | `dispatchReplicationObserver`/`safeNow` | 公共面与信号分发同款复用（`emitSignal` try/catch 逐监听者） | 一致 | SA8 行 23 锚 |
| 出站帧字节快照 vs mux 就地盖章 | —（新面） | `deliverOutbound` 投递前快照字节 + 采样占位序 | — | 正确处理缝内时刻语义 |

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
| --- | --- | --- | --- |
| admission 结局 | edge 台账（只写不删、promise 多播） | 描述子 ok-投影（不可变快照） | 低 |
| 通道表 | 各 sink 的 `channels`（公共/拒绝互斥命名空间） | edge `.channels` 只读投影（shim 下仅拒绝侧，R7 登记） | 低 |
| wire 序分配 | edge `OutboundQueue.emitOne` | 无（session 占位 0；桥原样回传返回值） | 低 |
| 路由相位 | 桥内 per-ns 单份 | 无第二份 | 低（互斥单调不可逆 + 双守卫单一放弃点） |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
| --- | --- | --- | --- |
| 首 OPEN → routing 相位 | authorized → 公共句柄（随连接存活）/ denied 或载体提交 → denialSink 通道 | E10 1011 收口；closed 守卫放弃 | ✓ |
| `open()` 同步建句柄 | `close()` 幂等（sink closeTail 单 promise；round A11 断言） | connection-fatal → closed 投影 + 出站 0 | ✓ |
| `onFrame`/`onSignal` 注册 | 退订函数（退订仅当当前 listener 匹配） | 监听者 throw 隔离 | ✓ |
| 桥 per-connection | edge `requestSinkClose` → fan-out（句柄 + denialSink） | dropConnection 回调 | ✓ |

### 平行机制检查

| Candidate duplicate | Existing path | Actual path | Disposition |
| --- | --- | --- | --- |
| 第二 FSM / 错误码表 / codec 语义 | — | 无（违例/拒绝应答全部由零 diff 通道产出；中继经 `encodeMessage` 单一 codec） | ✓ |
| 桥 accept 门链 | `hub-connection.ts` accept | test 夹具镜像 + 差异清单头注登记（R12） | 允许（test-only + 结构必然） |
| 公共 host `sessions` 表 vs sink `channels` 表 | listen：sink channels 永不删除 | host sessions 永不删除（`hub-session-host.ts:239-256`） | 登记见 §A-12-O4 |

## A-6. 文件范围审查（iteration 0；= 交付提交 `a315e70` 的 13 条 ALLOW 路径）

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/ws-replication/src/hub-session-host.ts`（新增） | ALLOW 第 1 条 | D1–D5 唯一新生产代码 | ✓ |
| `packages/ws-replication/src/index.ts` | ALLOW 第 2 条 | append-only 追加 1 值 + 7 类型 | ✓（既有 11 名零变化） |
| `packages/ws-replication/src/hub-session.ts` | ALLOW 第 3 条 | 重命名 + 别名删除 + 头注（零行为） | ✓ |
| `packages/ws-replication/src/hub-connection.ts` | ALLOW 第 4 条 | import/调用点/头注跟随 | ✓（3 处） |
| `packages/ws-replication/src/hub-split.ts` | ALLOW 第 5 条（仅头注） | 注释真实性 | ✓ |
| `packages/ws-replication/test/issue420-shim-hub.ts`（新增） | ALLOW 第 6 条 | D6/D7 夹具 | ✓（仅深路径 import） |
| `packages/ws-replication/test/ws-replication-issue420-session-host-api.test-d.ts`（新增） | ALLOW 第 7 条 | AC1 | ✓ |
| `packages/ws-replication/test/ws-replication-issue420-session-host-round.test.ts`（新增） | ALLOW 第 8 条 | AC2/AC4/AC5 | ✓ |
| `packages/ws-replication/test/ws-replication-issue420-shim-matrix.test.ts`（新增） | ALLOW 第 9 条 | AC3 | ✓ |
| `…issue418-edge-session-split-contract.test.ts` | ALLOW 第 10 条（§12.6 编辑 1） | 冻结表 +1 行 | ✓ |
| `…issue418-edge-session-split-structure.test.ts` | ALLOW 第 11 条（§12.6 编辑 2） | 机械跟随 | ✓（7 行） |
| `docs/adr/0032-…md` | ALLOW 第 12 条 | RA1 附录 | ✓（+23 行，决策文本未改） |
| `CONTEXT.md` | ALLOW 第 13 条 | RA1 词条 | ✓ |

DENY 核对：`hub-namespace.ts`、`hub-edge.ts`、`src/testing.ts`、其余 src 单点、协议文本、7 矩阵文件、上游包、`apps`/`domains`/`package.json` —— **全部零 diff**。无 ALLOW 外改动。

## A-7. 契约连锁审查（iteration 0）

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `src/index.ts` 追加导出 | plugin.ts / nomic-server / 外部宿主 | append-only；`:551` 全等断言兼容；V8 node 侧 12 名实测 | 无 | — |
| `createHubSessionHost`→`createHubSessionSink` 重命名 | `hub-connection.ts:18/:449` + structure 测试锚 | 调用面封闭（旧名仅存于 `artifacts/sa6-*.mts` 诊断探针，不在任何 gate include 面） | 无（gate 面） | §A-12-O6 |
| `HubSessionSink` 面（edge → 桥代理） | `hub-edge.ts` | 六成员全实现；`openNamespace` 三分支 + 载体提交覆盖 edge 全部投递形态 | 无 | — |
| edge 台账 ⟺ route 在场锁步 | `dispatchReady` R-delivered 仅台账命中 | 桥对 route 缺失的 `namespaceFrame` 走响亮 `INTERNAL_ERROR`(1011)——结构上不可达 | 无 | §A-12-O2 |
| 公共句柄 listener 替换语义 | 宿主（夹具） | 后注册替换、退订仅当前匹配时置空 | 无 | — |
| `terminateUnauthorized`（revoke 链） | `ShimHubImpl.revoke` → edge → 桥 | 相位路由 + 挂起 + finally 收口；R11 时序观测边界维持登记 | 无（登记面） | — |
| matrix 文件二次注册 | `vi.mock` 动态 import | 断言体零编辑；ac7 值导入 `createPeerReplication` 经 `...actual` 保真 | 无 | — |

## A-8. 错误、恢复与并发（iteration 0）

| 场景 | 实现行为 | Assessment |
| --- | --- | --- |
| E1 出站 listener 缺席/返回 0 | `deliverFrame` 返 0 → 通道既有响亮失败；A12 红臂断言 `ACK_STATE_VIOLATION` + `close(1002,'protocol-error')` + onSignal 命中 + 回合不可达 live | ✓ |
| E2 `handleFrame` 解码失败 | `connection-fatal{code ?? 'MALFORMED_FRAME'}`，零吞帧 | ✓ |
| E3 连接级/方向域 kind | 静默（显式列名 + default 转发至内部壳后同样静默） | ✓ 净行为等价 |
| E4 pending 溢出 | `CONNECTION_POLICY_VIOLATION`(1008) 响亮 + 窗口清空 | ✓ |
| E5 `open()` 前置违反 | 同步 throw（M7 变异日志含 `重复开启` 签名） | ✓ |
| E6 信号/observer 监听者 throw | `emitSignal` 逐监听者 try/catch；observer 经 `dispatchReplicationObserver` 单点 | ✓ |
| E7 `close`/`terminateUnauthorized` 幂等 | sink closeTail 单 promise；terminate 无通道 resolve | ✓ |
| E8 并发 | 同步 pipe；续体单异步段；pending 冲刷在同步段内；相位互斥单调；JS 单线程 | ✓（SA2 N2' 头注 + M7b 反证） |
| E9 恢复/重试 | 无新增重试面；resync/reauth/revoke 走零 diff 通道 | ✓ |
| E10 续体非预期 throw | 整段 try/catch → `connectionFatal('INTERNAL_ERROR', 1011)`；零无承载 reject；两 suite unhandled 哨兵绿 | ✓ |
| 载体提交 × admission 迟归结算 | 续体 `route.phase !== 'routing'` 早退；authorized 结局下该 ns 由生产 splice 完整承载 | ✓（登记见 O1/O5） |
| 载体提交丢弃入窗 OPEN 条目 | 与 listen `finalize` 不应答 openWaiters 同构 | ✓ |
| 桥 closed 后迟归帧 | 句柄通道已 quiesce → quiet/terminal 守卫吸收 | ✓ |

## A-9. 测试质量审查（iteration 0）

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `…session-host-api.test-d.ts` | 冻结签名正控全集 + 负控 `@ts-expect-error` ×6 | `vitest --typecheck` + 包 tsconfig 双面 | 无（TS2578 敏感性由 V5 绿背书） | — |
| `…session-host-round.test.ts`（10 用例） | A1–A11 运行时/wire 原字节断言 + A12 红臂 + C5a/C5b/C5c + C4a–C4d | 根 vitest include | 无 skip/only/todo；A12 `waitFor:'none'` 为红臂设计形态 | — |
| `…shim-matrix.test.ts` | 7 文件断言体零编辑二次执行 + 末位反空跑 + afterAll 零 unhandled | 同上 | 反空跑锚 `settled`（ac5-live `ACK_STATE_VIOLATION` 用例为 peer 侧 fatal，亲读 :132-150）；connection-fatal 正控由 A12 红臂承载；SA6 冻结要件全在场 | §A-12-O5 |
| 变异 M1–M7/M7b | M2 丢 OPEN（9 红）、M3 二次盖章（7 红）、M4 关 shim（恰反空跑红）、M5 session 重检序（9 红）、M7/M7b（2 红）、M1 内建红臂 | 日志 `artifacts/sa3-issue420-mutation-*.log` | M1 以夹具内建开关承载 = 设计 §12 A12 行明示形态 | §A-12-O7 |
| 红阶段证据 | V1 8×TS2305+TS2307、V2 3 failed | `sa3-issue420-red-*.log` | 红因 = 能力缺口 | — |
| 基线对账 | 77/588 → 80/651（+3 文件/+63） | package-suite / baseline 日志 | 数字自洽 | — |

---

# Part B — iteration 1 finalization repair 评审（本轮）

## B-1. Reviewed inputs

| 输入 | 状态 |
| --- | --- |
| `wiki/raw/task_issue-420_sa3_impl.md`（iteration 1 节：触发、C1 规范形、18 条变更路径表、V17–V21b、staging 清单） | 已读（全文） |
| `artifacts/sa3-issue420-evidence-reconcile.log`（656 行冻结证据日志：§0 诊断复现 + pre-state 字节事实、§1 命令、§2 内容保持证明、§3/§4 staged C1 扫描与 gate、§5 业务面保持、§6 V17–V20 重跑、§7 范围/引用完备性/终态哈希/staging 清单/post-commit 期望/残余项） | 已读（全文，逐节核对） |
| Git 只读复核：`git status --porcelain -uall`、`git diff --cached --stat`、`git diff HEAD --stat -- packages docs CONTEXT.md .editorconfig vitest.config.ts package.json`、`git diff --check`、`git reflog -5`、`git ls-tree HEAD` × 13 ALLOW 路径 + `git hash-object` 逐一比对、`git show HEAD:wiki/raw/task_issue-420_{design,sa2_review,sa3_impl,sa4_review,sa6_contract,sa7_report}.md` 引用普查 | 已执行 |
| 独立哈希/C1 复算：18 条候选路径 sha256（[:16] 全对 + reconcile 日志全量 64-hex）、字节数、行数、trailing-ws/CR/末字节扫描；被归一化行号内容抽查（cat -A） | 已执行 |
| `wiki/raw/task_issue-420_sa9_standards.md`（§10-M3 原文、verdict approve、requiresConflictRecheck: false）与 `wiki/raw/task_issue-420_sa10_spec.md`（verdict approve） | 已读（要点） |
| `wiki/raw/task_issue-420_implementation_conflict_report.md`（工作区版 = SA8 iteration 6 rebase 就绪终认；diff vs HEAD 亲读；requiresConflictRecheck: true 窄域） | 已读（要点） |
| `wiki/raw/task_issue-420_sa6_contract.md`（HEAD 版 §16 :413 smoke.mts 已删除登记；§12 冻结面） | 已读（要点） |
| `.editorconfig`（C1 规则三行亲证）+ #419 先例 commit `bd75a2c`（`test(replication-protocol): canonicalize evidence contract` 亲证存在） | 已核对 |
| SA3 iteration 0 报告（V1–V16、Deviations 1–4、iteration 1 追记） | 已读（全文） |

## B-2. Verdict（iteration 1）

**`approve`**（0 × BLOCKER；0 × MAJOR；6 × MINOR 非阻断观察 O8–O13）。

判定链（全部为本轮独立复核证据，非采信 SA3 自述）：

| # | 声明 | 独立复核结果 |
| --- | --- | --- |
| 1 | 工作区改动恰为 18 条 staging 清单路径 | `git status --porcelain -uall` = 2 M + 16 ??，与 §7.4 清单**逐条相同**，无第八条以外改动 |
| 2 | 零业务面字节变化 | 13 条 ALLOW 路径 `git hash-object` vs `git ls-tree HEAD` **13/13 IDENTICAL**；`git diff HEAD --stat -- packages docs CONTEXT.md …` 空 |
| 3 | 归一化仅空白、终态 C1 全清 | 18 路径 trailing-ws=0 / CR=0 / 末字节恰一 LF 且前字节为内容字节；`git diff --check` RC=0；行号抽查与 gate `{WS}` 诊断吻合 |
| 4 | after 哈希声明真实 | 报告表 16 个 after sha256[:16] 与实测全同；reconcile 日志全量 sha256/53056 B/656 行全同；§7.3 全量表前缀逐条相符 |
| 5 | 真实 index 零写入、无 commit/push | `git diff --cached --stat` 空；reflog HEAD@{0} = `a315e70`（交付后无 commit） |
| 6 | 引用完备性（SA9 §10-M3 闭合） | HEAD 六报告 issue420 artifact 引用逐条解析：全部 committed-at-HEAD 或在本 staging set；唯一例外 `sa6-issue420-smoke.mts` = SA6 §16 :413 登记的已删除临时脚本；SA9 §10-M3 未跟踪清单（12 artifact + 简报）与被归一化 13 路径**恰同一集合** |
| 7 | 无 hash registry 破坏 | HEAD 六报告 40/64-hex 扫描仅命中 `7039f6d…` commit OID，零 artifact sha256 注册 |
| 8 | 归档补齐符合先例 | SA9（approve）/SA10（approve）终审 + Host 简报 + SA8 iteration-6 报告随交付归档 = #418/#419/#421 同款惯例；#419 规范化先例 commit `bd75a2c` 在库 |
| 9 | 内部一致性 | §0 pre-state（bytes/lines/sha）↔ §2 Δbytes 算术 ↔ 当前实测三方吻合（如 M2 10921→10912 = −9 = 8 行 × 1 尾空白 + 1 EOF LF；M3 −8；M5 −9；sa6-runner −4 无 EOF 项）；census 29+13=42 artifacts、10+3=13 wiki 条目吻合 |
| 10 | 重跑验证（V17–V20） | 冻结日志内命令行 + exit 码齐全（63/63、tsc 0、80 files/651 tests、根 typecheck 0），与 iteration 0 同口径零回归声明自洽；SA4 不重跑测试，以日志完备性 + 业务面零字节变化为判定基础 |

## B-3. 上游要求落实（iteration 1）

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| finalization repair 派工目标：把交付提交后遗留工作区的证据集归并为**可提交（gate-clean）**，不改已批准实现语义 | 13 路径 C1 归一化（§0 诊断 39 findings / 13 路径 → §4 GATE_RC=0）；13 ALLOW 路径 blob 身份 13/13 | 落实（本轮亲证） |
| SA9 §10-M3：commit 证据集不完整——finalize/提交方在同一交付归档中补齐（#418 先例含任务简报） | 18 条 staging 清单覆盖 M3 全部列举路径 + SA9/SA10 终审 + SA8 报告；引用普查 UNRESOLVED=0（本轮独立复现） | 落实 |
| Owner 评论 | 两轮派工均 none、REST `[]`——无逐条映射义务 | 无遗漏 |
| SA6 §16 保留诊断资产原样 | 3 个 `.mts` 探针 import 旧名维持原状（SA3 Deviation 2 迭代 1 追记继续有效；不在任何 gate include 面——iteration 0 已核） | 维持登记（§B-12-O6） |
| SA9 §10-M7 / SA4 O7（变异日志缺命令行） | 本轮**不重写**历史日志正文（仅 C1 空白）——§7.6 R4 登记；reconcile 日志自身带命令行（部分改善增量证据卫生） | 维持登记 |

## B-4. 设计落实审查（iteration 1：对派工目标的落实）

| 目标要素 | 实现位置 | Assessment | Finding |
| --- | --- | --- | --- |
| C1 规范形 = `.editorconfig [*]` 三规则 + 门规则 | `.editorconfig` 亲证三行在册；18 路径全部满足（1）LF 前无 [ \t]（2）EOF 无 [ \t]（3）恰一末尾 LF | 落实 | — |
| 归一化命令幂等且可复算 | `perl -0777 -i -pe 's/[ \t]+(?=\n)//g; s/\n+\z/\n/'`（§1 逐路径记录）；当前态重放为零改动（C1 态即幂等不动点，本轮扫描等价证明） | 落实 | — |
| 3 条本已 C1 路径零改动 | impl_conflict_report / sa9_standards / sa10_spec：§0 pre-state sha = 当前 sha（`590ef35d…`/`434fd836…`/`fba2b74a…`），本轮实测相同 | 落实 | — |
| reconcile 日志自身 C1 | tw=0、恰一末尾 LF；`{WS}` 嵌入约定（:29-30）避免日志自违 | 落实 | — |
| V21a/V21b 终态 gate（17→18 路径含报告自身） | 声明 GATE_RC=0 / C1 18/18（报告 §V21b）；本轮以文件级 C1 扫描独立复现同一事实（18/18 清） | 落实（判定不依赖该次实跑记录） | — |
| post-commit 锚 | §7.5：`git show HEAD:<path> | sha256sum` 对照 §7.3 全量表——Controller 可机械复核 | 落实 | — |

## B-5. 架构一致性与惯例（iteration 1）

| 检查面 | 事实 | Assessment |
| --- | --- | --- |
| 归档惯例对照 | #419 `bd75a2c`（canonicalize evidence contract）同款 C1 归并先例；#418/#421 归档范围（简报 + SA9/SA10 + SA8 报告）同族 | 一致 |
| 单一事实源 | 证据字节终态唯一登记于 reconcile §7.3 + SA3 报告表（两处一致，本轮比对）；无第二份哈希账 | 无漂移 |
| 生命周期对称性 | 无新增资源；scratch index 是临时只读验证面，真实 index 未触碰 | ✓ |
| 平行机制 | 无新增 cleanup/worker/包装；归并是对既有证据文件的原位规范化 | 无 |

## B-6. 文件范围审查（iteration 1）

| Changed path | 授权 | 用途 | Assessment |
| --- | --- | --- | --- |
| 12 条 artifact 日志（9 sa3 + sa6-runner-trigger-red + 2 sa7） | 本轮派工（finalization repair：归并证据集使其可提交）；gate 诊断命中路径集合 | 仅 C1 空白归一化 | ✓（内容保持证明 §2 + 本轮行号抽查） |
| `wiki/raw/task_issue-420.md`（Host 简报） | 同上（#418/#419 先例归档含简报；gate 诊断命中） | 去 EOF 空行 1 字节 | ✓ |
| `artifacts/sa3-issue420-evidence-reconcile.log` | 本轮派工（证据） | 归并与验证原文（656 行） | ✓（C1 自洽） |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物（skill：原位更新实现报告） | 登记 iteration 1 | ✓ |
| `wiki/raw/task_issue-420_{sa9_standards,sa10_spec}.md` | 非 SA3 写入（SA9/SA10 终审产物）；本轮仅纳入 staging 清单 | 交付归档补齐（SA9 §10-M3） | ✓（零字节改动） |
| `wiki/raw/task_issue-420_implementation_conflict_report.md` | 非 SA3 写入（SA8 iteration 6 原位改写，内容含其自身派工号 `sa-4515a5eb…`/mabf-sa8）；SA3 零字节改动（§0 pre-state sha = 当前 sha） | 交付归档补齐 | ✓ |
| 13 条 ALLOW 路径 + `packages/**`/`docs/**`/`CONTEXT.md`/`.editorconfig`/`vitest.config.ts`/`package.json`/`tsconfig*` | 迭代边界 | **零改动**（本轮 13/13 blob 身份 + diff 空） | ✓ |

- **无越界**：工作区全部改动 = 18 条清单内路径；SA3 无 `git add`/`commit`/`push`（index ≡ HEAD、reflog 单条交付 commit）。

## B-7. 契约连锁审查（iteration 1）

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| 证据文件字节变更 × 哈希注册面 | HEAD 六份交付报告 | 零注册（仅 commit OID）；归并不可破坏既有引用 | 无 | — |
| 证据文件字节变更 × 报告路径引用 | HEAD + 工作区报告（sa3_impl iteration-1 节、SA8 iter-6） | 全部引用路径可解析（committed 或 staging set；smoke.mts = 登记删除例外） | 无 | — |
| staging 清单 × Controller finalize | §7.4 逐行 `git add -A --` 形式 + §7.5 post-commit 复核锚 | 清单完备精确（= 工作区全部改动）；漏 stage 即阻断 finalization 的风险已由「清单 = git status 全集」消除 | 无 | — |
| 归档内 verdict 文本互操作性 | SA8 iter-6（requiresConflictRecheck: true，窄域 rebase）vs SA9/SA10（approve，false，针对 iter-0 SA8 报告作出） | SA3 零改动 verdict 文本；张力由 §7.6-R1 显式登记给 Controller | 登记面（非本轮缺陷） | §B-12-O11 |
| iteration-0 D7 裁决文本的可追溯性 | 最终归档读者 | SA8 iter-6 原位改写后，iter-0 实现复查的 D7 逐条裁决表仅存于 git 历史（`a315e70` blob `34d26e3`）；iter-6 报告以「前轮账」引用其结论（RA1''–RA4''、行 27/44/94） | 低（历史可取） | §B-12-O12 |

## B-8. 错误、恢复与并发（iteration 1）

| 场景 | 行为 | Assessment |
| --- | --- | --- |
| 归一化误伤内容字节 | §2 内容保持证明（nonws_bytes_equal / rstrip_content_equal 全 YES）+ 本轮行号/形态抽查；仅空白缺陷被移除 | ✓（before 态不可独立复算的残余见 §B-12-O8） |
| C1 形态在 commit 时再漂移 | C1 = 幂等不动点（无尾随空白 + 恰一末尾 LF，任何规范化器重放零改动）——与 #419 事故形态（raw 注册态带 EOF 空行）相对 | ✓（§7.5 注释成立） |
| Controller stage 错误字节（非当前工作区态） | §7.5 post-commit `git show … | sha256sum` 对照 §7.3 提供机械验收锚 | ✓（流程护栏） |
| 中途失败（归一化半途/scratch index 残留） | 归一化为逐文件原子 perl -i；真实 index 无涉；scratch index 在 /tmp（会话级） | ✓（交付面无残留） |
| 并发变异探针干扰重跑 | §6 声明顺序执行（无并发探针）；冻结日志时间戳连续 | ✓ |

## B-9. 测试质量审查（iteration 1）

| Test/验证 | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| V17 契约三路径 | 3 files / 63 tests / Type Errors 0 / exit 0 | reconcile §6（命令行 + 输出原文冻结） | 无（与 V3 同口径） | — |
| V18 包 typecheck | tsc exit 0 | reconcile §6 | 无 | — |
| V19 包全量 | 80 files / 651 tests / Type Errors 0 / exit 0（Duration 47.45s 原文在册） | reconcile §6 | 无（与 V4 同口径，零回归声明自洽） | — |
| V20 根 typecheck | 15 tsconfig 串行 exit 0（命令链原文在册） | reconcile §6 | 无 | — |
| V21a/V21b gate | scratch-index cached gate + 逐 staged blob C1 扫描 17→18 全 PASS | SA3 报告 §V21b（实测记录） | 本轮以文件级 C1 扫描独立复现同一事实；判定不依赖该记录 | — |
| 测试源码面 | iteration 1 零测试字节变化（13 ALLOW blob 身份含 4 个测试路径 + 夹具） | `git hash-object` 亲证 | 无弱化可能（字节未动） | — |

## B-10. Required revisions

**无阻断 finding**（0 × BLOCKER / 0 × MAJOR）。登记回流项：

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance | Suggested routing |
| --- | --- | --- | --- | --- | --- | --- |
| SA4-O1（承 iteration 0，仍开放） | MINOR（登记回流） | `artifacts/sa3-issue420-design-letter-divergence.log`；`test/issue420-shim-hub.ts:311-327` + 头注；SA8 iter-0 裁决（HEAD 历史 blob `34d26e3`） | 设计 §7 D7 `namespaceFrame` 行文本仍为字面 pending-窗口机制，与落地载体提交不一致（SA8 已裁 implements-existing-decision，文本滞后） | SA1 把 D7 该行修为「非 OPEN 帧在 routing 相位即时提交生产承载；在途 OPEN 入有界 pending 窗口」（ADR 附录 A2 β 措辞随裁） | 设计文本与夹具行为一致；AC3 七文件 shim 臂维持断言逐字不变全绿 | design |
| SA4-O5（承 iteration 0，仍开放） | MINOR（登记回流） | `test/issue420-shim-hub.ts:322` 相位命名 | 载体提交使相位 `denied` 语义扩大为「承载 = 生产 splice」 | 随 O1 一并澄清命名/语义（如 `carrier-committed`） | 设计/夹具注释无歧义 | design |

## B-11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| post-commit 字节锚 | Controller（finalize 时执行 §7.5） | `git show HEAD:<16 路径> | sha256sum` 与 §7.3 全量表逐条相等 | 任一不等（commit 携带了非 C1 字节或清单遗漏） |
| rebase 后证据失效重取 | Controller/SA8 RA2（§7.6-R2） | rebase 到 `1f5809b` 后按五门在新树重取证；C1 字节形仍有效、树绑定失效 | 援引 pre-rebase 证据合并交付 |
| `vi.mock` 平台稳定性 / R11 / 载体提交角落 / handles 键 / suppressSequenceReturn | 承 iteration 0 §11 各行（不变） | 同 iteration 0 | 同 iteration 0 |

## B-12. Non-blocking observations

| # | 观察 | 依据 | 建议 |
| --- | --- | --- | --- |
| O2（承 iter-0） | 桥 `namespaceFrame` 防御分支形态与内部 splice `withChannel` 不同（均结构不可达且响亮） | `test/issue420-shim-hub.ts:288-292` | 维持登记 |
| O3（承 iter-0） | 夹具 `handles` 以 namespaceId 为键，多连接同 ns 后开覆盖先开 | 夹具 :133/:378 | 未来多连接断言前改复合键 |
| O4（承 iter-0） | 公共 host `sessions` Map 无删除路径（冻结语义字面兑现） | `src/hub-session-host.ts:239-256` | 后续宿主接线票明确生命周期 |
| O6（承 iter-0 = SA9 M4） | SA6 三个诊断探针 `.mts` import 重命名前旧名，不在任何 gate include 面 | `artifacts/sa6-issue420-*-probe.mts`；§7.6-R3 | SA6/Controller 重跑探针时改 `createHubSessionSink` |
| O7（承 iter-0 = SA9 M7，部分改善） | M1 变异日志 `1 passed | 9 skipped` 无命令行回显；本轮对**归一化命令**逐路径记录（§1），历史变异日志正文未重写（§7.6-R4 明示不重写边界） | reconcile §1/§7.6-R4 | 后续变异日志统一带命令行 |
| **O8（新，iter-1）** | 13 条被归一化路径的 **before 态哈希不可独立复算**（原文件未跟踪、无外部注册表；`/tmp/sa3-420-recon/before/` 快照在 SA3 会话外不可达）。缓解：§0 gate 诊断行号与 before 行数吻合、Δbytes 算术自洽、行号内容抽查吻合、after 态全量亲证、操作幂等性在当前态等价证明 | reconcile §0/§2 vs 本轮实测 | 未来同类归并先把 pre-state 哈希落进将被提交的载体（本轮 §0/§7.3 已做到——提交后即成永久注册）；post-commit §7.5 复核闭环 |
| **O9（新，iter-1）** | iteration-1 派工原文未持久化于 worktree（触发诊断 `MABF_FINALIZE_REPAIR_REQUIRED`/`whitespaceViolations` 仅见报告引述）；跨 owner 产物（SA6/SA7 日志、Host 简报）的空白改写授权依赖该派工面 | SA3 报告 :14-15；§0 诊断命中的 13 路径恰为被改集合（含他 SA 产物）——与 gate 驱动的最小修复面一致，内容保持证明约束爆炸半径 | Controller 归档本轮时附派工/诊断原文（或其引用），使授权链可审计 |
| **O10（新，iter-1）** | Host 简报 `wiki/raw/task_issue-420.md` 被 C1 化（−1 字节 EOF 空行）——上游输入产物的字节改写；#418/#419 先例已确立「简报随交付归档」惯例，且简报正文内容行零变化（§2） | reconcile §2 末行；#419 `bd75a2c` 先例 | 维持现状（惯例内）；未来简报若引入受保护标记需在归并前显式豁免 |
| **O11（新，iter-1 = §7.6-R1）** | 归档内 verdict 标志张力：SA8 implementation 报告 iteration-6（随本轮归档）`requiresConflictRecheck: true`（窄域：rebase 后 index.ts 并集面未落树过门禁），而 SA9/SA10 终审（同批归档）`false`（针对 iter-0 SA8 报告作出）。SA3 明确零改动 verdict 文本、不预裁 rebase | SA8 iter-6 §10；SA9 :6；SA10 :32；reconcile §7.6-R1 | Controller 排序 rebase → RA2 五门重取证 → 冲突复查闭合；两标志的指称对象不同，非矛盾，需在归档说明中并陈 |
| **O12（新，iter-1）** | SA8 implementation 冲突报告被 iteration-6 原位改写后，iteration-0 的 D7 载体提交逐条裁决表（行 11 等共 8 处「载体提交」）不再在最新归档正文中，仅存 git 历史（`a315e70` blob `34d26e3`）；iter-6 以「前轮账」保结论引用 | 本轮 grep：工作区版「载体提交」×1 vs HEAD 版 ×8 | 归档说明或 reconcile 后续版补一句历史指针（`git show a315e70:wiki/raw/task_issue-420_implementation_conflict_report.md`） |
| **O13（新，iter-1）** | 本 SA4 review 的原位更新本身构成 18 条 staging 清单之外的新工作区改动（tracked-modified）；iteration-0 的同款产物由 Controller 随交付归档（`a315e70` 含 sa4_review） | 本文件；`git ls-files` 含 sa4_review | Controller 归档本轮评审产物（或并入同一次 finalize 归档），避免再次触发未跟踪/未提交证据诊断 |

---

**结论（iteration 1）**：`approve`。finalization repair 的交付完整性声明**全部经本轮独立复核成立**：业务面 13/13 ALLOW 路径与交付提交逐字节相同；工作区改动恰为 18 条精确 staging 清单；C1 归一化终态全清且与 gate 诊断、Δbytes 算术、行号内容三方自洽；真实 index 零写入、交付后零 commit/push；SA9 §10-M3 引用完备性判据独立复现闭合；无 hash registry 破坏。残余不可独立复算面（before 态哈希、派工原文持久化）均有边界证明与登记（O8/O9），不构成阻断。iteration 1 零决策文本变化，不引入新的 ADR 冲突面，本轮不提交 `requiresConflictRecheck`；在册的 rebase 门（SA8 iter-6 窄域 true）与 A2 β 措辞登记（SA4-O1 → design）维持原回流路由。

---

# Part C — CI 修复轮评审（SA3 iteration 4：PR #429 `3f470fb` 上两个 #423 测试文件的 D9 符号名机械跟随）

## C-1. Reviewed inputs

| 输入 | 用途 |
| --- | --- |
| 本轮派工（`sa-d6246063…`，implementation-review） | 评审范围：正确性 / TDD 证据 / 测试遮蔽面三问；Owner 评论 none、REST `[]` |
| `wiki/raw/task_issue-420_sa3_impl.md`（iteration 4 节 + Deviations #6/#7 + staging 清单） | 被评审的自述、根因归因、V29–V35、冻结锚登记 |
| `artifacts/sa3-issue420-ci-fail-evidence.log` 等 7 条 iteration-4 证据日志 | 红/绿定证；sha256 逐一亲算比对 |
| `wiki/raw/task_issue-420_design.md` §11（ALLOW/DENY LIST） | 范围裁定基线（`1f5809b` 基树口径） |
| `wiki/raw/task_issue-420_sa6_contract.md` §12.6 / U1 | 重命名授权与「机械跟随」类先例（授权编辑 2） |
| `packages/ws-replication/src/{hub-session,hub-split,hub-session-host,index,hub-connection}.ts`、`test/issue420-shim-hub.ts` | 符号权威面与既有消费方形态 |
| `packages/ws-replication/test/ws-replication-issue423-{sa7-dynamic,observer-emission-split,update-offset-guard}.test.ts` | 被修文件全文 + 第三 #423 文件旁证 |
| `packages/ws-replication/test/ws-replication-issue418-edge-session-split-{structure,contract}.test.ts` | #418 冻结锚（`:618` 导出面 / `FROZEN_PRODUCTION_EXPORTS`） |
| `git show 25c51cd:packages/ws-replication/src/hub-session.ts` | 父基重命名前导出面（stale 引用源头） |
| `.github/workflows/ci.yml`、`scripts/ci-test-shard.mjs` | V30/V33/V34「逐字」声明与 CI 触发性核对 |
| `git status` / `git diff` / `git log`（只读） | 实际改动面与谱系亲验 |

## C-2. Verdict

**`approve`**（0 × BLOCKER；0 × MAJOR；3 × MINOR 非阻断观察 O14–O16）——判定全文见 §2「CI 修复轮」。

## C-3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 本轮派工目标：修复 PR #429 的 CI 红灯（typecheck + Node 20/24 分片 1/6） | 两文件符号名跟随，零生产代码；V29–V35 全绿（含 CI 失败命令逐字重跑） | 落实 |
| SA8 RA2'（新基树五门重取）的 CI 面 | CI 红即新基树门禁的发现机制；修复后 typecheck 两步 / 失败分片 / 契约门本地逐字重取全绿；CI 线上重跑登记 Deferred（Controller） | 落实（本地面闭合；线上面已登记） |
| SA3 iteration-4 边界声明（零生产 diff / 零断言改动 / 零 skip / 零 git 写） | `git diff -- src/` 空、changed-lines grep 断言 0 命中、skip/only grep 0 命中、`git status` 全集 = 10 条 staging 清单 | 落实（逐项亲证） |
| Owner 评论 | none；REST `[]` | 无逐条映射义务 |
| Deviation #6（范围扩展）显式登记 + SA8 复认请求 | SA3 报告 Deviations #6，`requiresConflictRecheck: true`，附精确口径建议 | 落实（回流目标 = SA8 + SA9 §2.4 记录更新） |

## C-4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| §7 D9 / U1：内部 splice 重命名，公共名让给 byte-seam 工厂；消费方机械跟随 | 两 #423 文件 `import`/类型标注/工厂调用三点跟随；`hub-session.ts` 零字节再动 | 与 D9 同类落点（先例 = SA6 §12.6 授权编辑 2 对两 #418 文件） | 无 |
| 生产侧替代（恢复运行时/类型别名）被否决的论证 | #418 冻结锚 `…structure.test.ts:618` `toEqual(['createHubSessionSink'])` 亲证在场 ⇒ 运行时别名必红；类型别名不修运行期 `TypeError` 且被 D9 删除 | 否决论证成立——消费方跟随是唯一自洽最小修复 | 无 |
| SA6 §12.1 公共冻结签名 / #418 契约 / 7 文件矩阵 | 全部零 diff（`git status` 亲验） | 未触碰 | 无 |

## C-5. 架构一致性与惯例

| 面 | 事实 | Assessment |
| --- | --- | --- |
| 相似能力对照 | 导入形态与 `src/hub-connection.ts:18`、`src/hub-session.ts:23`（`HubSessionSink` 自 `./hub-split.js` 导入——模块自身权威形态）、#418 structure `:39`、`test/issue420-shim-hub.ts:66-68` 逐形一致 | 一致（未引入第二种写法） |
| 单一事实源 | 未恢复别名/再导出 ⇒ 包内不存在双名同物；`hub-session-host.ts` 公共工厂与内部 splice 保持单点 | 无第二事实源 |
| 平行机制检查 | 无 shim/adapter/marker/env 分支新增；修复纯消费方跟随 | 无平行机制 |
| 生命周期对称性 | 不适用（零生产/零资源生命周期面） | — |

## C-6. 文件范围审查

| Changed path | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/ws-replication/test/ws-replication-issue423-sa7-dynamic.test.ts` | 原 ALLOW（`1f5809b` 基树 13 路径）**不含**——文件随父增量 `1f5809b..25c51cd` 进入本树 | D9 符号名机械跟随 | **范围扩展（登记项，非静默越界）**：DENY「其余既有测试文件零改动」同为基树口径（文件彼时不存在，非 DENY 面被改写）；本轮派工明文 = 修复 PR #429 CI 红灯（Controller 直接授权该修复对象）；SA3 以 Deviation #6 + `requiresConflictRecheck: true` 提请 SA8 复认并给出精确口径（「CI 修复 commit 仅允许该两文件的符号名跟随」）——按「实现必要偏离 ⇒ 记录证据 + 建议路由」处置，不构成 MAJOR |
| `packages/ws-replication/test/ws-replication-issue423-observer-emission-split.test.ts` | 同上 | 同上 | 同上 |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物（原位更新惯例） | 登记 iteration 4 | 在例 |
| `artifacts/sa3-issue420-{ci-fail-evidence,ci-typecheck-fail,local-typecheck-pre-fix,local-prefix-wsrep-excerpt,ci-fix-typecheck,ci-fix-tests,ci-fix-contract-anchors}.log` ×7 | `artifacts/**` SA3 证据惯例（iteration 1–3 同款） | 红/绿定证载体 | 在例（sha256 逐一亲算相符） |
| （无其它路径） | — | `git status` 全集恰 10 条（3 modified + 7 untracked），生产/docs/CONTEXT/协议零 diff | 无超范围残留 |

## C-7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `hub-session.ts` 导出面（重命名后） | 全仓 `from '…/hub-session.js'` 消费方 = 4 处（shim-hub / #418 structure / 两 #423 文件） | 修复后全部用 `createHubSessionSink`；`HubSessionSink` 类型统一自 `hub-split.js` | 无 stale 残留（grep 亲验：旧名仅存于两文件头注散文、公共工厂自 `hub-session-host.js` 的正确用法、#418 契约公共导出清单条目） | 无 |
| 公共 API `createHubSessionHost`（`hub-session-host.ts` / `src/index.ts`） | `test/issue420-shim-hub.ts:59-227`（自 `../src/hub-session-host.js` 导入） | 未受修复影响；#423 fixture 未被误指向公共工厂 | 无 | 无 |
| #418 冻结结构锚 `:618` / 契约 `FROZEN_PRODUCTION_EXPORTS` | CI `contract-gates` 作业 | V35 逐字四步绿（5 文件/89 用例） | 无 | 无 |
| wire / 协议 / ADR 文本 | — | 零改动 | 无 | 无 |

## C-8. 错误、恢复与并发

- 红 = 响亮失败（TS2724/TS2305 编译错误 + ESM 具名导入缺席的 `TypeError`），无吞错、无降级为 pass、无 try/catch 包裹、无 env override、无 fallback 路径引入。
- 并发/生命周期面：不适用（零生产字节；测试 fixture 构造点替换，断言时序不变）。
- 修复可逆性：纯符号名跟随，revert 即回到红态（红态已由 CI 定证）——无部分完成语义。

## C-9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `ws-replication-issue423-sa7-dynamic.test.ts`（26 用例中 3 红：D-SEAM1a/b/c） | 缝上发送记账投影（占位序 UPDATE、真实时钟域残差、真实队列驻留、无 clock 面 ⇒ accounting undefined） | CI 分片 1/6（失败即证明被发现）+ 包全量 + V31/V32/V34 逐字重跑 | 无：断言零字节变化（changed-lines grep 0 命中）；用例数守恒（修复前 8 红 + 18 绿 = 修复后 26 绿）；fixture 仍直驱内部 splice | 无 |
| `ws-replication-issue423-observer-emission-split.test.ts`（26 用例中 5 红：EM-C1e/C3a/C3b/C3d/C4b） | 观测发射侧归属 / dormant 缺面形态 / 出站 sequence 事件归属 | CI 分片 6/6 + 同上 | 同上 | 无 |
| 遮蔽面四查 | — | — | ① skip/only/todo/xit：0 命中；② 断言/阈值/选择器：0 变更；③ fixture 未改指向公共工厂（测试意图保留）；④ 头注增量准确（「用例体、断言与选择器逐字不变」与 diff 亲证一致） | 无 |

## C-10. Required revisions

无 BLOCKER / MAJOR finding。（范围扩展的 SA8 复认为流程门，SA3 已自带请求；见 §C-11 第 2 行与 O14。）

## C-11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| 新 head 上 CI 重跑（5 红作业转绿） | Controller（SA3 禁 commit/push；staging 清单与预期门禁面已由 SA3 报告给出） | `typecheck` 两步、`test (20|24, 1)`、`test (20|24, 6)` 转绿；其余 11 作业保持绿 | 新 head 仍红 ⇒ 存在本轮未见第二根因，带新证据回 SA3/SA8（SA3 报告已明示不得以本地绿替代 CI 绿） |
| Deviation #6 范围扩展复认 + SA9 §2.4 卫生记录更新 | SA8 / SA9 | SA8 按「机械跟随落点新增」口径复认两文件改动；SA9 记录更新为「交付 commit `4e5ff0a` 零 diff；CI 修复 commit 仅允许该两文件符号名跟随」 | 合并前未复认即闭环 |
| 根 `pnpm test` 全仓重跑（443 文件） | Controller / SA7 | 全绿（本轮只改 2 个测试文件导入符号，包全量与两失败分片已实跑） | 任何包外回归红 |
| `artifacts/sa6-issue420-*-probe.mts` 陈旧旧名（承 O6） | SA6 / Controller | 重跑探针时改 `createHubSessionSink` | 维持登记（不在任何 gate include 面，本轮再证零命中） |

## C-12. Non-blocking observations

| # | 观察 | 依据 | 建议 |
| --- | --- | --- | --- |
| **O14（新，CI 修复轮）** | 两文件头注把重命名的授权出处括注为「SA6 §12.6 授权编辑 2」——严格说 §12.6 编辑 2 授权的是对 **#418 structure 测试**的机械跟随，重命名本身的授权 = 设计 §7 D9 / SA6 U1；括注易被读作「SA6 §12.6 授权编辑本 #423 文件」 | 两文件 `:36-39`/`:35-39` 头注；SA6 §12.6 原文 | 未来同类跟随头注把「重命名授权（D9/U1）」与「跟随先例（§12.6 编辑 2）」分列；或由 SA8 复认时一并澄清口径 |
| **O15（新，CI 修复轮；既有态非本轮引入）** | `src/hub-session.ts:49` 构造函数花括号与首语句同行（`constructor(…) {    const {…} = config;`）——合法 TS 但非仓内格式惯例；属已提交交付（本轮零生产 diff），非本修复面 | `hub-session.ts:49` | 后续触该文件的票顺手归一行（不改语义） |
| **O16（新，CI 修复轮）** | 首次类型导入尝试（自 `hub-session.js` 导入 `HubSessionSink`，被 tsc `TS2459` 拒绝）的中间态未归档为证据——SA3 已如实披露（「中间态未归档为证据」） | SA3 报告 §4.3 第 2 条 | 无需补证（终态正确性已由 tsc 绿 + 权威形态比对闭合）；未来多步修复可把被拒中间态一并落日志 |

---

**结论（CI 修复轮）**：`approve`。三问全部闭合：**正确性**——符号映射、配置七字段、接口面、导入形态与仓内权威消费方逐项亲证相符，stale 消费方全集恰为被修两文件；**TDD 证据**——红（CI 定证 + 本地独立复现，归因面唯一）→ 绿（V29–V35，含 CI 逐字命令重跑）链自洽，9 枚 sha256 冻结锚与 mtime 时序逐一相符；**无测试遮蔽**——断言/用例体/选择器零字节变化、零 skip、用例数守恒、fixture 未改指向公共工厂、CI 触发性由失败事实与分片同源枚举双重证明。唯一实质面 = 文件范围扩展（原 ALLOW 基树口径未含随父基进入的两文件），SA3 已按纪律显式登记并请求 SA8 复认（Deviation #6 + `requiresConflictRecheck: true`），且生产侧替代被 #418 冻结锚决定性封死——按「记录证据 + 建议路由」处置为登记项而非阻断项。零决策文本/ADR/协议触碰，本轮不提交 `requiresConflictRecheck`。

---

# Part D — CI 修复轮复审（committed `2c87b3b` + 验证证据全链；dispatch `sa-7bf71e86…`，iteration 1）

评审对象 = **已提交**的 CI 修复（`2c87b3b`「test(ws-replication): update internal splice imports」）及其诊断（SA3 iteration 4 + SA6 CI 修复轮契约）与验证证据（SA3 已提交 7 条日志、SA6 未提交 `artifacts/sa6-issue420-ci-repair/**` 22 日志 + 3 脚本、远端 CI/PR 状态）。与 Part C 的分工：Part C 评**提交前工作区态**（`3f470fb` 之上未提交改动），Part D 评**提交后与合并后态**——提交字节一致性、远端 CI 事实、SA8/SA9/SA10 终审闭环、SA6 轮证据质量。Owner 评论口径：none（REST `[]`，双端点亲验）。

## D-1. Reviewed inputs

| 输入 | 用途 |
| --- | --- |
| commit `2c87b3b`（12 路径）与 `5a4049d`（2 路径）全 diff、`git diff 3f470fb HEAD` 全集 | 已提交修复字节面与谱系亲验（生产零 diff 亲证） |
| `git diff 25c51cd HEAD -- 两 #423 测试文件`（剔注释 6 行代码集） | 机械性与无遮蔽亲证；用例计数 5→5 / 21→21 |
| `25c51cd:hub-session.ts` vs HEAD `hub-session.ts`/`hub-split.ts`/`hub-connection.ts` | 别名链类型同一性 + 导入形态权威对照 |
| `artifacts/sa3-issue420-ci-{fail-evidence,typecheck-fail,local-typecheck-pre-fix,local-prefix-wsrep-excerpt,ci-fix-typecheck,ci-fix-tests,ci-fix-contract-anchors}.log` | SA3 红/绿定证与冻结锚绿（已提交） |
| `artifacts/sa6-issue420-ci-repair/`（`run-green-gates.sh`/`run-red-prefix.sh`/`run-mutation-sensitivity.sh` + 32 条 `.log` + `probe-stale-internal-import.mts`，共 36 文件） | SA6 轮证据质量：单变量红实验、变异负控、五门绿、REST/merge 快照 |
| `wiki/raw/task_issue-420_sa6_contract.md`（工作区未提交改写版，CI 修复轮） | SA6 轮诊断/契约/verdict（approve）；前轮 feature 契约存档于 `git show 4e5ff0a:…` |
| `wiki/raw/task_issue-420_implementation_conflict_report.md`（SA8 CI 修复轮，committed） | Deviation #6 范围扩展裁决与 RA4'' 路由条件 |
| `wiki/raw/task_issue-420_sa9_standards.md` / `…_sa10_spec.md`（`5a4049d` 归档终审） | 终审 verdict（均 approve）与 N3（新 head CI 复跑）闭合 |
| 远端事实（`gh` 只读亲取）：run `35663498235`（head `3f470fb`，failure）、run `35665953800`（head `5a4049d`，success 16/16）、PR #429（MERGED，merge `4ad13a35`）、run `35666189272`（head `4ad13a35`，success）、issue/PR comments `[]` | 远端链独立定证，不采信日志自述 |
| `git rev-parse 4ad13a35^{tree}` vs `5a4049d^{tree}` | 合并态与已验证 PR head **树同一**（`187cc70f…`） |

## D-2. Verdict

**`approve`**（0 × BLOCKER；0 × MAJOR）——判定全文见 §2「CI 修复轮复审」。

## D-3. 上游要求落实

| Requirement or finding | Implementation evidence | Assessment |
| --- | --- | --- |
| 派工：评审诊断正确性 | 根因 = 两 #423 文件 stale 内部符号绑定；CI run `35663498235` 恰 5 红作业且错误逐字指向该两文件旧导入；SA6 单变量实验复现（4 TS + 8 TypeError） | 落实——根因唯一、证据可复核 |
| 派工：评审已提交修复正确性 | `2c87b3b` = 26 行机械集；导入形态与权威消费方逐形相同；类型经别名链同一；生产树 `3f470fb..HEAD` 零 diff（亲验） | 落实 |
| 派工：评审验证证据 | 红（CI+本地+单变量）→ 绿（本地五门 + SA3 七日志）→ 远端（run `35665953800` 16/16 + merge 树同一 + merge-commit run `35666189272` 绿）全链闭合 | 落实 |
| 派工：无测试遮蔽 | diff census 6 行代码集、计数守恒 5→5/21→21、零 skip/only/todo、变异负控 5 用例转红、fixture 未改道公共工厂（探针 distinct 证明） | 落实——四重独立证明 |
| SA3 iteration 4 自述（零生产/零断言改动、Deferred CI 重跑） | 与提交字节、`git status`、Controller 后续 push/merge 事实一致 | 落实 |
| SA6 CI 修复轮契约（K1–K8、NC-A~NC-F、变异敏感性、冻结锚禁生产别名恢复） | 契约文档 + 对应证据日志逐条在场；verdict approve | 落实 |
| SA9 N3（新 head CI 复跑待 Controller） | run `35665953800` 于 `5a4049d` 全绿 + PR 已 merge | 落实——闭环 |
| Owner 评论 | none；issue #420 与 PR #429 comments 均 `[]`（REST 快照 + gh 亲取） | 无遗漏要求面 |

## D-4. 设计落实审查

| Design decision | Implementation location | Assessment | Finding |
| --- | --- | --- | --- |
| 设计 §7 D9：内部 splice 重命名 `createHubSessionHost`→`createHubSessionSink`、删 `HubSessionHost` 别名（`hub-split.ts` 仅头注） | `hub-session.ts:299`（唯一运行时导出）；别名删除；`HubSessionSink` 权威面 `hub-split.ts:126` | 一致 | 无 |
| D9 的固有义务：全部内部消费方跟随重命名 | `hub-connection.ts:18,344` + 两 #423 测试文件（本轮修复）——全仓 grep 旧符号仅余公共面合法引用（`index.ts` 公共工厂、shim-hub、#418 冻结清单、#420 test-d） | 一致——stale 集合恰为被修两文件 | 无 |
| 修复绑定目标 = 内部 splice（非公共工厂） | 两文件 fixture 以 stub port 直驱 `createHubSessionSink`；探针 `C.publicFactory.distinctFromInternalSplice` | 一致——#423 测试意图原样保留 | 无 |
| #418 冻结锚（`toEqual(['createHubSessionSink'])`、`FROZEN_PRODUCTION_EXPORTS` 含 `'createHubSessionHost'` 公共条目） | `ci-fix-contract-anchors.log` 5 文件/89 用例绿；CI contract-gates 作业绿（红/绿两 run 均过） | 一致——禁生产别名恢复的替代路径被封死 | 无 |

## D-5. 架构一致性与惯例（平行机制 / 单一事实源 / 生命周期）

- **平行机制检查**：修复未引入第二套导入路径、wrapper、fixture 或 runner——`createHubSessionSink` 单一权威模块（`hub-session.ts`），类型单一权威面（`hub-split.ts`），与 `hub-connection.ts` 权威消费形态逐形一致。无平行机制。
- **单一事实源**：内部 splice 符号无别名残留（探针 A：旧名 `typeof undefined`；内部导出面恰 `['createHubSessionSink']`）；公共 `createHubSessionHost`（`hub-session-host.ts`）与内部 splice 名实分离，无第二事实源。
- **生命周期对称性**：不适用（纯测试符号跟随，零运行时生命周期面）；SA6 红实验与变异实验的临时改动均自逆转（sha256 恢复 + tracked 树净，`07-red-restore-check.log`/`09-mutation-restore-check.log` 亲读）。
- **证据归档惯例**：`2c87b3b`/`5a4049d` 沿用「代码修复 + 证据日志 + 报告归档」既有 commit 形态（#418/#419/#421 先例一致）。

## D-6. 文件范围审查（含 Part C 待办的闭合）

| Changed path（`3f470fb..5a4049d` 全集 14 路径） | ALLOW entry | Purpose | Assessment |
| --- | --- | --- | --- |
| `packages/ws-replication/test/ws-replication-issue423-{sa7-dynamic,observer-emission-split}.test.ts` | 原 ALLOW（`1f5809b` 基树 13 路径）不含——文件随父增量 `1f5809b..25c51cd` 进入 | D9 符号名机械跟随（CI 修复本体） | **范围扩展已获 SA8 裁决收编**：implementation 冲突报告（CI 修复轮）表行 1 裁为 `implements-existing-decision`（D9 重命名义务在新浮现 stale 消费方的兑现；许可性成立、无需扩枚举、无需 override），并给字节级 census 背书——Part C 的 Deviation #6 待复认项**闭合**，非静默越界，非 MAJOR |
| `artifacts/sa3-issue420-ci-*.log` ×7 | 证据归档惯例 | 红/绿定证 | 在例（SA3 iteration 4 staging 清单 10 条之内） |
| `wiki/raw/task_issue-420_sa3_impl.md` | SA3 固定产物 | iteration 4 报告 | 在例（10 条之内） |
| `wiki/raw/task_issue-420_sa4_review.md`、`…_implementation_conflict_report.md`（`2c87b3b`） | SA4/SA8 固定产物 | 本评审 Part C + SA8 CI 修复轮裁决 | 超 SA3 10 条清单的 2 条 = **Controller 定稿补入**（git 历史透明；两文件均为纯文档）——观察 O18，非违规 |
| `wiki/raw/task_issue-420_sa9_standards.md`、`…_sa10_spec.md`（`5a4049d`） | SA9/SA10 固定产物 | CI 修复终审归档 | 在例 |
| 工作区未提交：`wiki/raw/task_issue-420_sa6_contract.md` 改写 + `artifacts/sa6-issue420-ci-repair/**` untracked | SA6 固定产物 | SA6 CI 修复轮契约/证据 | 在制态（待 Controller 归档 commit）——观察 O17；SA6 原位改写轮次契约符合前例（SA9 同款） |

**DENY 面**：`packages/ws-replication/src/**`、`docs/**`、`CONTEXT.md`、`docs/adr/**`、`docs/protocols/**`、`src/index.ts`、7 文件 listen 矩阵、`package.json`、`.github/**` —— `git diff 3f470fb HEAD` 亲验**零命中**。

## D-7. 契约连锁审查

| Contract | Caller | Actual handling | Risk | Finding |
| --- | --- | --- | --- | --- |
| `hub-session.ts` 内部导出面（重命名后） | 全仓 grep + 根 typecheck + CI typecheck | stale 消费方恰两文件且已修；HEAD 根 typecheck exit 0（`02-head-root-typecheck.log` + CI SUCCESS） | 无 | 无 |
| 公共 API `createHubSessionHost`（`hub-session-host.ts`/`index.ts`） | `issue420-shim-hub.ts`、#420 test-d、#418 冻结清单、外部宿主 | 零 diff；test-d 与冻结锚绿 | 无 | 无 |
| `HubSessionSink` 类型权威面（`hub-split.ts:126`） | 两 #423 文件、`hub-connection.ts` | 导入形态逐形一致 | 无 | 无 |
| CI 分片枚举（`scripts/ci-test-shard.mjs` 与 vitest include 同源） | `test (20|24, 1..6)` | 修复后两文件被分片 1/6 真实执行（红 run 失败 + 绿 run 通过的事实对偶） | 无 | 无 |

## D-8. 错误、恢复与并发

- 修复本身零运行时语义（纯编译期符号跟随 + 类型同一标注），无新错误路径/并发面。
- 验证实验的错误处理纪律：红实验与变异实验均 `set -u` + sha256 前后锚 + 恢复后 tracked 树净检查（亲读三份 restore-check 日志，全部 SHA256_IDENTICAL + status 空）——无遗留脏树、无吞噬失败。
- 静态不可确认的残余运行风险：无（远端 CI 已在本轮独立定证绿）。

## D-9. 测试质量审查

| Test | Behavior asserted | Runner entry | Weakening or gap | Finding |
| --- | --- | --- | --- | --- |
| `ws-replication-issue423-sa7-dynamic.test.ts`（5 用例） | 缝上发送记账投影（真实时钟注入、accounting 残差界）——内部 splice 行为 | vitest include + 分片 1/6（红 run 3 用例 TypeError → 绿 run 过） | 无——断言/用例体/选择器零字节变化（`25c51cd..HEAD` 剔注释恰 3 行代码改动） | 无 |
| `ws-replication-issue423-observer-emission-split.test.ts`（21 用例） | observer 发射归属拆分（session/edge 两侧） | vitest include + 分片 1/6（红 run 5 用例 TypeError → 绿 run 过） | 无——同上恰 3 行代码改动 | 无 |
| 敏感性负控（变异 `accounting`→`undefined`） | 5 用例转红 | `run-mutation-sensitivity.sh`（focused vitest） | 无——证明修复后测试仍咬合生产行为 | 无 |
| 红实验（换回旧字节） | 4 TS 错误 + 8 TypeError 逐字复现 | `run-red-prefix.sh`（package tsc / root typecheck / focused vitest） | 无——单变量归因成立 | 无 |
| 既有 gate 中的 `registry-sa7-rev1.test.ts`（1 passed \| 5 skipped） | contract-gates 门集（namespace-registry 包） | CI `contract-gates` 作业（红 run 中亦 pass） | **与本修复无关的既有仓态**（不同包、修复零触碰、CI 门自身接受）；非本轮引入、非本轮遮蔽 | 无（登记于 §D-12 观察） |

**SA6 红灯断言保持 / skip·only·todo / 源码字符串断言 / 主路径触发 / fixture 隔离 / CI 触发性**：逐项核过——无违反（§2 第 3、5 条 + §D-3 表）。

## D-10. Required revisions

无。（0 × BLOCKER；0 × MAJOR）

## D-11. 后续动态验证项

| Risk | Driver | Expected observation | Failure condition |
| --- | --- | --- | --- |
| Controller 归档 SA6 CI 修复轮产物（`sa6_contract` 改写 + `artifacts/sa6-issue420-ci-repair/**`）后的新 tip CI | Controller push 后的 CI run | archive-only 变更 ⇒ 全绿（沿用 `5a4049d` 证据面） | 新 tip 任意作业红 ⇒ 新根因，回 SA3/SA8 |
| 父谱系再前移（≠ `25c51cd` 谱系） | SA8 RA4'' 条件 ③（已登记） | 复认后再解 | 未复认即解 ⇒ 回冲突门 |

## D-12. Non-blocking observations

| ID | 观察 | 证据 | 处置建议 |
| --- | --- | --- | --- |
| **O17（新，本轮）** | SA6 CI 修复轮全部产物（契约原位改写 + `artifacts/sa6-issue420-ci-repair/**` 36 文件）与 SA8 CI 修复轮冲突报告（新文件 `task_issue-420_ci_repair_conflict_report.md`，verdict `clear`，与本轮判定同向）均为未提交/未跟踪态——内容已核自洽，但尚无 committed 载体 | `git status`（`M wiki/raw/task_issue-420_sa6_contract.md` + `?? artifacts/sa6-issue420-ci-repair/` + `?? wiki/raw/task_issue-420_ci_repair_conflict_report.md`） | Controller 按既有归档惯例补 archive commit（同 `eb5ec09`/`3f470fb`/`5a4049d` 先例；SA8 RA1 同向） |
| **O18（新，本轮）** | `2c87b3b` 实际携带 12 路径，超出 SA3 iteration 4 报告的 10 条 staging 清单 2 条（`sa4_review.md` Part C、`implementation_conflict_report.md`）——均为 Controller 定稿补入的纯文档，git 历史透明，无隐藏代码字节 | `git show --stat 2c87b3b` vs SA3 报告清单 | 无需处置（登记口径）；未来报告可注明「Controller 可追加固定产物归档」 |
| O14（承 Part C） | 两文件头注把重命名授权出处括注为「SA6 §12.6 授权编辑 2」的措辞精度问题 | 两文件头注；SA8 CI 修复轮表行 1 已实质澄清口径（许可性成立） | 维持原建议（未来同类头注分列「授权」与「先例」） |
| O15（承 Part C） | `hub-session.ts:49` 构造函数格式（既有态，非本轮引入） | `hub-session.ts:49` | 后续触该文件的票顺手归一 |
| O16（承 Part C） | 首次类型导入中间态（TS2459 被拒）未归档 | SA3 报告 §4.3 | 已披露，无需补证 |
| （登记，不编号） | contract-gates 门集内 `registry-sa7-rev1.test.ts` 存在 5 个 skip——与本修复无关的既有仓态（修复零触碰该包；CI 门自身接受且红 run 中亦 pass） | `ci-fix-contract-anchors.log`；run `35663498235`/`35665953800` contract-gates 均 pass | 不属本轮面；如需清理归后续票 |

---

**结论（CI 修复轮复审）**：`approve`。已提交修复（`2c87b3b`）在诊断正确性、实现正确性、无测试遮蔽三个轴上全部经本轮**独立**复核成立：根因唯一（远端 run + 单变量实验 + 机制探针三方定证）、修复为类型同一的机械符号跟随（别名链亲证 + 权威消费形态逐形对照 + 生产树零 diff 亲验）、无遮蔽四重证明（字节 census / 计数守恒 / 零抑制标记 / 变异负控咬合）；远端验证链闭合（修复 head 16/16 绿 + merge 树同一 + merge-commit run 绿 + PR MERGED，均 gh 亲取）。Part C 唯一登记项（范围扩展待 SA8 复认）已由 SA8 `implements-existing-decision` 裁决收编。零 BLOCKER / 零 MAJOR；O17–O18 为流程登记性 MINOR。本轮不提交 `requiresConflictRecheck`。
