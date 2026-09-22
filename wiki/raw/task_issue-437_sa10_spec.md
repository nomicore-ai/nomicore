# SA10 Spec 审查 — issue #437：lease 端到端数组逐元素校验行为钉死（ADR 0033）

- 角色：SA10（独立 Spec 审查者，iteration 0）
- 审查对象：最终交付 commit `b262854`（`test(registry): cover lease array element validation`）
- 权威基线：父 PR #434 分支 `spec/433-yarray-elementwise-validation` @ `02c7cfb1abf88f764690aaabf8c31a20074e7179`（与交付相对静止；`git diff 02c7cfb..HEAD` 即交付全集）
- Owner 评论：REST issue-comment read 返回 `[]` —— **无 owner comment 需求面**（与 dispatch 声明一致）
- 审查方式：静态审查（issue 正文/ADR 0033/设计/SA2/SA3/SA4/SA6 逐件对读、测试三件套全文审查、committed diff 只读 git 核对、证据日志逐份核对、冻结指纹 md5 复算）；未运行测试、未修改任何工件

---

## 1. Verdict

**approve**。无关键 AC partial/unmet/unachievable；无 scope creep；交付忠实满足 issue 正文、
AC1–AC6 与 SA6 验收契约（approve 件）的全部要求。须随 PR 披露的未达成/边界项见 §6
（全部为非阻断残余与 MINOR 观察）。

## 2. 交付形态核对（test-only 约束）

| 核对项 | 方法 | 结果 |
|---|---|---|
| 生产实现零改动（issue 正文「本 ticket 不改实现」） | `git diff 02c7cfb..HEAD --name-only -- 'packages/*/src' 'apps' 'domains' 'vitest.config.ts' 'tsconfig*.json' 'package.json' 'packages/*/package.json' 'pnpm-lock.yaml'` | **0 行输出** ✓ |
| committed diff 全集 | 21 文件 = 测试三件套（contract 398 行/13 it、control 173 行/7 it、fixture 524 行非测试入口）+ 探针 1 + wiki 工件 6（design/sa2/sa3/sa4/sa6_contract/sa6_probe）+ artifacts 日志 12（sa3×5、sa6×7） | 全部落在设计 §10 ALLOW LIST 内 ✓ |
| DENY LIST 未触碰 | 逐面核对 doc-runtime/vfsl/namespace-runtime/namespace-registry/namespace-diagnostic-log 的 `src/**`、`issue-435/436` 既有测试、ws 线级面、规范面（docs/adr、CONTEXT.md）、配置面 | 零 diff ✓ |
| 冻结件忠实性 | md5 复算四件：契约 `62de8c31…`、负控 `34f50039…`、夹具 `9fa5995f…`、探针 `3b647b42…` | 与 SA6 §16 冻结值**逐字一致** ✓（SA3 原样采纳、未软化断言的声明属实） |
| 判据纪律 | sweep 三件套：零 `.skip/.only/.todo/.each`、零 `process.env`、零 `setTimeout`（仅注释中的纪律声明）、零吞错 catch（唯一 try 为读计数包装的 try/finally 复位）、零源码字符串断言 | 干净 ✓ |

## 3. AC 逐条判定

| Issue AC | 交付落点 | SA10 独立核对 | 判定 |
|---|---|---|---|
| **AC1** 行为变化钉正：raw-replication 污染（元素载体/值非法）数组 array-delete 照常成功（旧语义响亮拒绝）；触达面外非法数据不被普通写发现 | 契约 AC1-a..e（contract.test.ts:59-143）：值污染+delete/insert、载体非法（裸 number 入记录数组）、字段值非法（`qty:'x'` Y.Map）、批量信封内分流，五形态均断言 `{ok:true}` + 污染逐值保留（`['oops',1,3,4,5]` 等）+ 恰一 owned update；写前 `readData` 可见性前置断言证污染在场；负控 C1 同污染 union 腿响亮拒绝作 A/B 反证 | 污染注入唯一经 `session.applyRemoteUpdate`（fixture `applyRawRemote`，trusted raw 面，对端固定 clientID、仅 insert 新元素）——确为「raw-replication 污染」语义；五形态覆盖 AC 括注的载体/值两面且含 delete/insert 两 op。**判别敏感性实证**：旧实现 `7407ce0`（#435 合、#436 未合）同命令 6 红/14 绿（baseline-focused.log FAIL 行逐条 = AC1-a..e + AC2-d，红因逐字 = legacy 全量边界判决 `类型不匹配：期望 number，实际 string` path `['items',0]`），3 轮稳定（md5 `762f1f30…`）——红/绿归因于 #436 接线，非环境/夹具 | **MET** |
| **AC2** 不变量：非法新元素零写入 + issue 路径 `[...arrayPath, index+j]` 不变；越界拒绝语义不变；空批量 noop 不变 | AC2-a（:149-180）：`values:[8,'x','y']` 整笔零写入 + paths `['items',2]/['items',3]`（合法首值跳过、非法逐个 +j）+ 嵌套 `['rows',1,'qty']` + 零 update；AC2-b（:182-200）：越界 delete/insert 逐字 message（`array-delete 范围越界（不 clamp、不接受越界 no-op）` / `array-insert index 越界（不 clamp）`）+ path + 零写入零 update；AC2-c（:225-252）：`values:[]`/`count:0`/`{ops:[]}` 三形态信封形状门逐字拒绝 + 零写入零 update；AC2-d（:202-223）：fast 轨读计数 ≤8（n=64，HEAD 实测 0）且 union legacy ≥n（实测 191）且 legacy>fast | 期望 message/path 与现行实现源文逐字一致（SA2 §6/SA4 §3 已对 `mutation.ts:820/829/649/654/256` 逐字核验，本审查抽查测试断言文本一致）；index+j 语义与 `mutation-local.ts:361` `[...mutation.path, index+i]` 一致；旧实现基线上 AC2-a/b/c 全绿 ⇒「不变量」成立；AC2-d 基线红（127>8）⇒ O(k) 解耦的判别腿有效 | **MET**（「空批量 noop」措辞定案见 §5.1——已披露的解释，非缺口） |
| **AC3** union 数组目标端到端行为与性能路径不变（仍走全量边界校验） | 负控 C1（union 同污染照旧逐字拒绝 `联合成员 1/2：类型不匹配：期望 number，实际 boolean` path `['uarr',0]` + 零写入零 update）、C2（干净写两 op ok）、C3（非法新值 issue path `['uarr',1]`）、C7（union legacy 读计数 ≥n=64，实测 191）+ AC2-d 同规模对照腿（fast 0 vs legacy 191） | 行为面（逐字判决，源文 `validate.ts:529/:203`）+ 性能面（读计数 ∝n 的结构锚，机器无关计数、不钉毫秒——合 ADR 0033 决策 6 软验收）双腿钉死；C1 与 AC1 构成同夹具/同污染/同 op 的 A/B 闸门对照 ⇒ AC1 断言非恒真 | **MET** |
| **AC4** 诊断烟测：fast path 后 committed update bytes 记录形态不变 | AC4-a（:258-296）：`root-mutation`/`transaction`/`committed effect:update` 分类 + inline carrier 键集（`base64/crc32c/format/payloadLength/storage`，crc32c 形态正则、payloadLength 与字节数一致性经 `carrierBytes` 断言）+ 同基态重放收敛 `[1,2,3,4,5,42]` + 空 doc 不物化 ROOT（反整文档编码鉴别）；AC4-b（:298-313）：数组写 vs 标量 set 写 record/carrier 键集逐键同构 | 形态三面（键集/真事务增量重放/空 doc 反证）+ 同构对照，非仅值相等；`records.length===1` 精确计数为有意形态冻结（SA4 O-C，MINOR） | **MET** |
| **AC5** 复制烟测：fast path 提交经 replication apply 对端收敛、无协议面变化 | AC5-a（:319-357）：hub 写 → 恰一 owned update → 三通道独立收敛（纯 Y.Doc 同基态重放 / peer `applyRemoteUpdate` / `encodeDiff` 定点 apply 后值不变）+ session 状态面（`open`/`hub-to-peer`/`localRole:'peer'`/`remoteInstanceId:'hub-437'`）；AC5-b（:359-397）：owned update 对空 doc 不物化（最小增量形态）+ 每提交恰一事件 + 二次写再恰一；负控 C6 批量单事务单事件 | AC 措辞「经 replication apply」即 session 面——交付在 `ReplicationSession.applyRemoteUpdate` 公共面立法，收敛非租约读路径自证（三通道含纯 Y.Doc 字节 oracle）；线级（ws transport/wire-frame）烟测按 ADR 0033「复制协议零改动」状态行明示票外（§6 D-1，已披露残余） | **MET** |
| **AC6** 根 `pnpm typecheck` 与 `pnpm test` 绿 | committed 证据：`artifacts/sa3-issue437-root-typecheck.log`（`TYPECHECK_EXIT:0`，15 包）、`artifacts/sa3-issue437-root-test.log`（**466 files / 5667 tests 全绿**、Type Errors no errors、`ROOT_TEST_EXIT:0`；L378/L584 两新文件被真实收集 13+7 tests）、`sa3-issue437-wide-typecheck.log`（`WIDE_TSC_EXIT:0`）、`sa3-issue437-focused.log`（20/20，`FOCUSED_EXIT:0`）、`sa3-issue437-probe.log`（32/32，`PROBE_EXIT:0`） | 行号引用逐行复核命中（root-test L378/L584 确为两新文件 run 行）；探针 P5a/P5b 独立通道（tsx 非 vitest）复核 fast=0 vs legacy=191，排除 vitest 夹具自证；HEAD 聚焦 5 轮稳定 20/20（head-stability-1..5 在位抽查一致） | **MET** |
| issue 正文「经 lease `mutateData` 的端到端测试、最高 seam 立法、防止演进漂移」 | 全部用例唯一观察入口 = `lease.mutateData/readData`（真实 Registry testing seam 装配 → 生产 Runtime → `registry.open` → lease）；fixture 非 `.test.ts` 不入发现面；未来演进（退回全量边界/改 issue 路径/改 union 分流/改诊断 carrier/破坏复制增量）将在判别组或不变量组显红——基线 6 红实测了可显形性 | seam 选择正确（lease 为用户可见判别联合最终形状面，`lease.ts:392-394` 透传）；立法而非修复的任务定性准确（能力缺口 = lease 面 0 件覆盖，SA6 census） | **MET** |

## 4. 需求面完整性

- **Owner 评论**：`[]` —— 空需求面，无映射缺口（设计 §4、SA6 §2、SA2 §4、SA4 §1 一致声明，与 dispatch 上下文一致）。
- **Blocked by #436**：已合（HEAD `02c7cfb` 含 `f61e583`），前置满足。
- **Parent PR #434**：交付基线即该分支 HEAD `02c7cfb`，diff 相对静止，无基线漂移。
- **SA6 验收契约（approve）**：B-1..B-7 绑定点逐条落实（§3 表）；契约 13 + 负控 7 全绿、探针 32/32、旧实现判别组 6 红——契约声明的绿色判据全部命中且在案。
- **ADR 0033 决策映射**：决策 1（双轨闸门）→ AC1 组 × C1–C3；决策 2（O(k)/零写入/issue 路径/commit 形态）→ AC2-a..d、AC4、C5/C6；决策 4（触达面收窄）→ AC1 判别组；决策 6（软性能验收）→ 读计数结构代理（不钉毫秒）。决策 3（S9 收窄）与决策 5（一致性 fixture）按切分归 #436/#435 面，本票不重复——切分与 ADR 状态行（影响包仅 vfsl/doc-runtime；协议/诊断/写槽零改动）一致。

## 5. 措辞定案与解释记录（非缺口，须 PR 披露）

### 5.1 AC2「空批量 noop 不变」定案

lease seam 可观察事实：`values:[]` / `count:0` / `{ops:[]}` 在**信封形状门**被拒（旧新同码同
path、零写入零 update；基线 E6 对照实证「不变」）。「恒等 accept 的 noop」是 vfsl 接缝性质，
已由 #435 B6（`packages/vfsl/test/issue-435-elementwise-array-contract.test.ts:167`，在位复核）
钉死，两不重叠。交付按 lease seam 可观察行为立法（AC2-c），该解释在设计 §7.5 与 SA6 §2
显式记录，无 owner 冲突面。**判定：合理解释 + 已披露，非 unmet。**

### 5.2 SA2/SA4 已定案的 MINOR 处置

SA2 O-1..O-4（设计理由表述、矩阵排序、清理措辞、探针 yjs 直取）全部按建议位置落实
（SA3 报告内更正，三件套 md5 不变）——符合设计 §7.6 采纳政策；SA4 复核属实。

## 6. 须随 PR 披露的未达成项与残余边界（均非阻断）

| ID | 类别 | 内容 | 依据 |
|---|---|---|---|
| D-1 | 票外残余 | **线级（ws transport / wire-frame）复制烟测未做**——AC5 在 `ReplicationSession.applyRemoteUpdate` 面立法 | ADR 0033 状态行「复制协议零改动」；AC 措辞「经 replication apply」即 session 面；设计 §1.2/§12、SA6 §15 残余 1 明示如需另开票 |
| D-2 | 票外残余 | **并发/多写者数组写竞争未覆盖**（单写者 smoke） | 设计 §1.2、SA6 §15；#436 面亦未覆盖 |
| D-3 | 票外残余 | **lease seam 大 n（≥512）性能基准未做**——以 n=64 元素读计数作机器无关结构代理（fast 0 / legacy 191）；更大规模软证据由 #436 doc-runtime 面（n∈{512,4096}）承担 | ADR 0033 决策 6 软验收；设计 §1.2 |
| D-4 | MINOR（SA4 O-A） | AC1 污染均位于触达区间外；**「删除区间包含污染元素本体」的形态在 lease seam 未单独立法**（按 ADR 0033 决策 2 亦应 ok:true）——属可选扩展面，AC 第二分句「触达面外」的措辞支持现有最小可判定装置 | SA4 §12 O-A |
| D-5 | MINOR（SA4 O-B） | 拒绝零 update 断言窗口 `flushMicrotasks(24)` 与生产常量 `FANOUT_DELIVERY_DEFERRAL_MICROTASKS=20` 隐式耦合；票外若抬高该常量，理论上存在漏检迟到泄漏的敏感性 | SA4 §12 O-B |
| D-6 | MINOR（SA4 O-C） | AC4-a `records.length===1` 精确计数为有意形态冻结（额外记录即形态漂移信号）；红灯时应走形态变化判定而非改断言 | SA4 §12 O-C |
| D-7 | MINOR（证据打包） | 判别敏感性原始日志（`sa6-issue437-baseline-focused/stability-1..3`、`sa6-issue437-head-focused/stability-1..5`）**未随 commit 提交**（worktree untracked 在位）；committed 证据 = SA6 契约（记录红/绿结果与 md5 `762f1f30…`）+ `sa6-issue437-cleanup-check.log` 指纹 + 全部门禁日志。AC6 根门禁证据完整在 commit 内；判别证据以契约文档 + 指纹形式可追溯 | 本审查 git 核对 + untracked 日志抽查（红集逐条 = AC1-a..e + AC2-d，与契约声明一致） |

## 7. Scope creep 审查

无。交付严格落在设计 §10 ALLOW LIST（三件套 + 探针 + wiki 工件 + artifacts 日志）；
DENY LIST 零触碰（§2）；非目标四条（不改生产、不重复 #435/#436 立法面、不做线级烟测、
不做并发/大 n 基准）与 ADR 0033 状态行、SA6 §15 残余清单一一对应，无静默扩张。
AC1-b（insert 腿）超出 AC1 字面的「array-delete」但属 ADR 0033 决策 4 同一行为变化的
另一半，且 AC 括注「元素载体/值非法」本身即要求多形态覆盖——属 AC 的忠实展开而非 creep。

## 8. 结论

交付 = 对 SA6 approve 契约的逐字节忠实立法（md5 四件复核一致）+ 完整 committed 门禁
证据链（聚焦 20/20、探针 32/32、根 typecheck exit 0、宽 tsc exit 0、根 test 466/5667 全绿
且两新文件被真实收集）+ 生产零改动。AC1–AC6 全部 MET；判别敏感性有旧实现 6 红/14 绿
（3 轮稳定）+ HEAD 5 轮 20/20 + 探针独立通道三重背书；无 scope creep；无关键 AC
partial/unmet/unachievable。§6 七项披露项（3 票外残余 + 4 MINOR）须在 PR 中明示。
**verdict = approve**。
