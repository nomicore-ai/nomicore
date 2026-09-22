# SA2 设计攻击评审 — issue #437：lease 端到端数组逐元素校验行为钉死（ADR 0033）

- 角色：SA2（iteration 0；独立攻击评审）
- 评审对象：`wiki/raw/task_issue-437_design.md`（SA1，iteration 0）
- 评审日期基线：HEAD `02c7cfb`（含 #435 `006e416`、#436 `f61e583`，`git merge-base --is-ancestor` 复核）

## 1. Reviewed inputs

| 输入 | 存在性 | 备注 |
|---|---|---|
| `wiki/raw/task_issue-437.md`（任务简报） | ✓ | issue 正文 AC1–AC6、Blocked by #436；Comments 节空 |
| `wiki/raw/task_issue-437_design.md`（SA1 设计） | ✓ | 354 行，本次评审对象 |
| `wiki/raw/task_issue-437_sa6_contract.md`（SA6 契约） | ✓ | approve；HEAD 20/20（5 轮）、基线 `7407ce0` 6 红/14 绿（3 轮）、探针 32/32 |
| `wiki/raw/task_issue-437_sa6_capability_probe.mts`（探针） | ✓ | md5 与契约 §16 一致（复核见 §6） |
| 冻结三件套（契约/负控/夹具，worktree untracked） | ✓ | md5 三件与契约 §16 逐件一致（复核见 §6） |
| `wiki/raw/task_issue-437_relevant_decisions.md` / `_conflict_report.md` | ✗（不存在） | iteration 0 无 SA8 工件；设计 §6 如实声明并以替代规范约束面补位 |
| Owner comments | ✗（REST issue-comment read 返回 `[]`） | 无 owner comment 需求面；设计 §4 与 SA6 §2 一致声明 |
| 源码/ADR/AGENTS/既有测试/artifacts 日志 | ✓ | SA2 直接读取核验（锚点复核见 §6/§12） |

## 2. Verdict

**approve**。无 BLOCKER、无 MAJOR。设计完整、内部一致、与仓库架构及测试惯例一致，
test-only 约束成立（`git diff` 空，仅新增 untracked 文件），每条 AC 映射到可执行的
最高 seam（lease `mutateData`/`readData` + session/诊断公共面）证据，且判别敏感性有
旧实现基线实测背书。4 条 MINOR 观察不阻断（见 §14）。

## 3. 需求覆盖

| Requirement | Design section | Assessment |
|---|---|---|
| AC1 污染数组 array-delete 照常成功；触达面外非法数据不被普通写发现 | §7.2 AC1-a..e（判别组）+ §7.3 A/B 对照 | 覆盖。AC1-a..e 覆盖值污染（insert/delete 两 op）、元素载体非法、元素字段值非法、批量信封内分流；「不被发现」以写后污染保留（`['oops',1,3,4,5]`）+ union 腿同污染响亮拒绝（C1）双向钉死。写前 `readData` 可见性前置断言证污染在场。基线 AC1-a..e 实测红（§5.3） |
| AC2 非法新元素零写入 + issue 路径 `[...arrayPath, index+j]` 不变 | §7.2 AC2-a + 负控 C4/C5 | 覆盖。`['items',2]/['items',3]`（index+j，合法首值跳过）与嵌套 `['rows',1,'qty']` 均钉；零写入零 update 断言在案 |
| AC2 越界拒绝语义不变 | §7.2 AC2-b | 覆盖。delete/insert 越界 message 逐字（`mutation.ts:820/829` 源文核对一致）+ path + 零写入零 update |
| AC2 空批量 noop 不变 | §7.2 AC2-c + §7.5 定案 | 覆盖。措辞歧义定案（见 §5）按 lease seam 可观察事实立法：`values:[]`/`count:0`/`{ops:[]}` 信封形状门拒绝（基线 E6 同码同 path 绿 ⇒「不变」成立）；恒等 accept 属 vfsl 接缝，引 #435 B6（`packages/vfsl/test/issue-435-elementwise-array-contract.test.ts:167` 实锚核对一致），两不重叠 |
| AC3 union 数组目标端到端行为与性能路径不变 | §7.2 负控 C1–C3 + C7 + AC2-d legacy 腿 | 覆盖。行为逐字（C1 union 仲裁 message `联合成员 1/2：类型不匹配：期望 number，实际 boolean`——与 `validate.ts:529/203` 源文一致）+ 干净写（C2/C4）+ issue path（C3）+ 结构性性能锚（C7 读计数 ∝n；AC2-d 同规模对照 fast=0/legacy=191） |
| AC4 诊断烟测：committed update bytes 记录形态不变 | §7.2 AC4-a/b | 覆盖。record 分类 + inline carrier 键集 + 同基态重放收敛 + 空 doc 不物化（反整文档编码）+ 数组写 vs 标量写记录/carrier 键集逐键同构 |
| AC5 复制烟测：fast path 提交经 replication apply 对端收敛、无协议面变化 | §7.2 AC5-a/b + 负控 C6 | 覆盖。三通道（纯 Y.Doc 同基态重放 / peer `applyRemoteUpdate` / `encodeDiff` 定点）+ 最小增量形态（空 doc 不物化）+ 每提交恰一事件（二次写再恰一）+ session 状态面。「无协议面变化」以协议承载物（owned update 字节 + 收敛）为锚，线级烟测明示为票外（ADR 0033 明文协议零改动；AC 措辞「经 replication apply」即 session 面）——边界与 SA6 §15 残余 1 一致 |
| AC6 根 `pnpm typecheck` / `pnpm test` 绿 | §9 验证映射 | 覆盖。映射到根 gates 复跑；SA6 post 证据实测 exit 0（typecheck）+ 466 files/5667 tests 全绿、两新文件被真实收集（post-root-test.log L377/L646 复核） |
| issue 正文「不改实现、只立法」 | §1.2 非目标 + §10 DENY | 覆盖。生产零改动实测成立（本 worktree `git diff` 空、`git status` 仅 untracked 新增） |

目标与非目标未被静默扩大：非目标四条（不改生产、不重复 #435/#436 立法面、不做线级
烟测、不做并发/大 n 基准）与 ADR 0033 状态行、SA6 §15 残余清单一一对应，无越界。

## 4. Owner评论覆盖

维护者 REST issue-comment read 返回 `[]` —— **无 owner comment 需求面**。设计 §4
如实声明（「唯一需求面 = issue 正文 AC1–AC6 + Parent PR #434 + Blocked by #436（已合，
HEAD 含 `f61e583`）」）；`f61e583` 为 HEAD 祖先已复核。无映射缺口。

| Comment ID | Updated at | Design section | Assessment |
|---|---|---|---|
| （无） | — | — | 空 set；无需覆盖 |

## 5. 上游事实与SA8约束

| Fact or constraint | Design response | Assessment |
|---|---|---|
| SA8 工件不存在（iteration 0） | §6 如实声明，以替代规范约束面（ADR 0033 决策 1–6、仓库测试纪律、AGENTS）补位并逐条给落实位置 | 合理。缺失不构成阻断：本票 test-only、零决策修订，替代约束面完整可执行 |
| ADR 0033 决策 1（闸门/永久双轨） | §7.2 AC1-a..e + C1–C3 只立法不改闸门 | 与 ADR 正文一致（「双轨是有意保留，不是待清理的债」） |
| ADR 0033 决策 2（O(k)/零写入/issue 路径/commit 形态） | §7.2 AC2-a..d、AC4-b；域 message/issue path 逐字冻结 | 与 ADR「issue 路径/顺序是兼容行为，钉回归测试」的自我要求一致——本票正是该立法的 lease seam 执行 |
| ADR 0033 决策 3（S9 收窄/E201） | 不触碰（#436 doc-runtime 面承担） | 正确切分：决策 3 属改造面行为，已由 `issue-436-array-fastpath-*` 立法（文件在位复核） |
| ADR 0033 决策 4（触达面收窄：污染 delete 转成功） | §7.2 AC1 判别组 | 行为变化钉正；基线红因逐字（`类型不匹配：期望 number，实际 string` + `path:['items',0]`）恰为 legacy 全量边界判决 |
| ADR 0033 决策 5（逐元素一致性 fixture） | 不重复（#435 已交付） | 文件在位（`issue-435-elementwise-array-*`）；无重复立法 |
| ADR 0033 决策 6（性能软验收） | §7.4 结构性读计数代理（≤8/≥n，机器无关），不钉毫秒 | 符合「不钉绝对毫秒数」；n=64 对照 fast=0 vs legacy=191 实测稳定 |
| ADR 0033 状态行（协议/诊断/写槽零改动） | §1.2、§10 DENY LIST | 生产面 DENY 全覆盖三个包；实测 `git diff` 空 |
| 仓库测试纪律（零 skip/only/todo、零 env、零源码字符串断言、真实入口） | §7.7 装置纪律 | 冻结三件 sweep 复核：无 `.skip/.only/.todo`、无 `process.env`、无 `readFileSync`/源码文本断言、无 `setTimeout`（唯一 `try{}` 是读计数包装的 try/finally 复位，非吞错）；发现面 glob 核对一致 |
| `packages/namespace-registry/AGENTS.md`（host 级 owner、testing seam、公共入口） | §7.1 装配走 `createNamespaceRegistryForTesting` + `/testing` 导出 + 诊断包公共 index | 一致。registry 确为 runtime/lease/session 的 host 级 owner——AC4/AC5 装配只在此面可达；测试控制全部经显式 testing surface，无 `src/index.ts` 外新增公共 API |
| `docs/AGENTS.md`（wiki/raw 为证据面） | 本评审产物与设计均落位固定路径 | 惯例一致 |
| 「空批量 noop」措辞歧义（AC2） | §7.5 定案：按 lease seam 可观察事实 = 空载荷形状拒绝不变；恒等 accept 引 #435 B6 | 定案成立。lease seam 两侧（旧/新）同码同 path 拒绝（基线 AC2-c 绿 + E6 对照）⇒「不变」语义满足；ADR 决策 2 的「空批量经 hasContent 守卫为 noop」属 vfsl/commit 层（lease 信封门先拒，该层从 lease 面以空批量不可达）；无 owner comment 面，无冲突方 |

## 6. 设计内部一致性

逐项核验结果（SA2 直接读源码/artifacts 复核，非转述）：

- **源码锚点全对**：`lease.ts:392-394`（mutateData 透传）/`:330-331`（readData 透传）、
  `write.ts:187`（`applyValidatedMutation` 唯一写入口 + `:177-207` 诊断捕获窗口同槽）、
  `mutation.ts:245-258`（批量信封门）/`:649`（insert 非空数组）/`:654`（delete 严格正整数）
  /`:820/829`（越界域 message 逐字）、`mutation-local.ts:314-374`（`case 'array'` 双条件
  闸门 + F1–F5 + legacy 分支）、`vfsl/src/index.ts:139` 与 `validate-patch.ts:1079`
  （`applyElementwiseArrayMutation`）、`validate.ts:529`（`联合成员 ${winner+1}/${N}：`）
  与`:203`（`类型不匹配：期望 ${type}，实际 …`）、`replication-session.ts:166-169`
  （core 方法面）/`:424-428`（role/direction 派生）/`:491+`（applyRemoteUpdate）、
  `testing.ts:86/126`、`vitest.config.ts` include、`tsconfig.typecheck.json`、
  registry `tsconfig.json` 只含 `src/**`——**全部与设计 §2 表一致**。
- **冻结指纹复核**：契约 `62de8c31…`、负控 `34f50039…`、夹具 `9fa5995f…`、探针
  `3b647b42…` 四件 md5 与本 worktree 文件逐件一致（设计 §7.6「已复核」声明属实）。
- **测试矩阵与实物一致**：契约文件实数 13 `it()`（AC1-a..e ×5 + AC2 ×4 + AC4 ×2 +
  AC5 ×2），负控 7 `it()`（C1–C7）；断言要点与 §7.2 表逐条对应；§7.4 读计数实现
  （实例包装 `get/toArray/forEach`、窗口覆盖整个 `mutateData` await、finally 复位）
  与夹具 `countElementReadsAsync` 实码一致，且与 `mutation-local.ts` F2 注释
  「不经 get/toArray/forEach ⇒ 不计数」互证。
- **证据链自洽**：head-focused 20/20、head-stability 1–5 全 20/20、baseline-focused
  6 红/14 绿（红集逐条 = AC1-a..e + AC2-d，`×`/`FAIL` 行核对）、baseline-stability 1–3
  同红集、probe 32/32 `PROBE_EXIT:0`、post-typecheck `TYPECHECK_EXIT:0`、
  typecheck-tests `WIDE_TSC_EXIT:0`、post-root-test `TEST_EXIT:0` 466/5667 全绿 +
  L377/L646 两新文件被收集——设计 §3/§5/§9 引用的每一项证据都在 artifacts 在位且
  数值一致。
- **前后无矛盾**：正文、矩阵、§8 数据流三路线、§9 映射、§11 调用方矩阵、§12 风险
  相互一致；无死引用（抽查 §7.7 两条惯例引证 `registry-create-diagnostic-red.test.ts:95`、
  `issue-393-ndcl-self-binding-red.test.ts:59` 与 #435 B6 `:167` 均实锚命中）；
  无旧 API/伪修订（iteration 0 无既有设计）。

小瑕疵（不阻断，详见 §14）：§7.2 矩阵 AC2 排序列 a/b/c/d 而冻结文件实际声明序
a/b/d/c（语义无差，独立夹具）；§7.7 一句理由性表述与 package.json 事实不符（见 O-1）。

## 7. 状态机与并发攻击

| ID | Initial state | Trigger | Expected behavior | Design gap | Required revision |
|---|---|---|---|---|---|
| S-1 | 污染经 raw apply 进入 live doc（并发项按 clientID 决胜的不确定合并风险） | `applyRawRemote` 以 live 当刻状态为基态求增量 | 污染确定在场且形态确定 | 无缺口：装置纪律强制远端一律**插入新元素**（不写既有键/元素），clientID 三方固定（hub 4242 / snapshot 4243 / remote 999999）——回避 Yjs 并发项决胜 | 无 |
| S-2 | 写在 sequencer 槽内、`await` 之后执行（读计数窄窗口漏计风险） | `countElementReadsAsync` 包装窗口 | 计数覆盖整个 `mutateData` promise 窗口 | 无缺口：设计 §7.4 显式论证该时序（`write.ts:187` await 后执行），实现为包装整个 await 窗口 + finally 复位（实例属性 delete，非 prototype 替换，零残留） | 无 |
| S-3 | 一次提交应恰一 owned update；订阅面不得累积/重复扇出 | AC5-b 二次写 | 二次写再恰一事件 | 无缺口：`waitForOwnedUpdates` 有界沉降 + flushMicrotasks 后精确等值断言；C5/C6 干净写/批量单事件对照 | 无 |
| S-4 | 拒绝路径零写入零 update（写后读可见性） | AC2-a/b/c、C1、C3 | 拒绝后逻辑值不变、ownedUpdates=0 | 无缺口：拒绝后 `readData` 复读原值 + flush 后 `ownedUpdates.length===0` 双锚 | 无 |
| S-5 | 多 fixture 并发互扰（vitest 并行） | 20 tests 各自开 registry/lease/session | 测试间零共享状态 | 无缺口：每 test 独立 fixture（独立 persistence/registry/scheduler/doc）；根配置 `maxWorkers: 1`；5 轮稳定实测 | 无 |
| S-6 | registry/session 生命周期不对称（测试不显式 close） | 每测试结束 | 无真实计时器/进程残留 | 无实质缺口：受控 fake scheduler（零真实 timer）、零网络零长驻进程；与包内主流测试惯例一致（50 个既有测试文件仅 5 个显式 close）。§8 L1「fixture 生命周期随 registry 关闭」措辞与实况不符（见 O-3） | 无（措辞修正见 §14） |

本票无生产状态机变化（test-only），上述为测试装置自身的状态/并发攻击面——全部闭合。

## 8. 错误与恢复攻击

| ID | Failure | Current design behavior | Risk | Required revision |
|---|---|---|---|---|
| E-1 | 实现阶段聚焦套件红灯（HEAD 已 20/20 绿） | §7.6 第 4 条：视为**生产回归信号**，上报 Controller，不得为绿改测试/改生产 | 无静默降级路径；fail loud 且定位到事实 Owner | 无 |
| F-2 | 判别组未来变恒真（闸门被移除后 AC1 与 C1 同化） | §12 风险表显式登记（中风险）+ 三重缓解：A/B 双腿、探针独立通道（tsx 非 vitest）、SA6 留基线复跑方法学 | 已知已缓解；本票可做的结构性防御（旧实现红）已做实 | 无 |
| F-3 | 逐字 message 断言因文案演进变红 | §12：有意为之——ADR 决策 2 把 issue 路径/顺序定为兼容行为；红灯即契约变化信号，走 ADR 修订而非静默改断言 | 方向正确：不伪造成功、不软化断言 | 无 |
| F-4 | 污染注入失败/未到场（夹具假证据） | `applyRawRemote` 断言 `applied.ok`；写前 `readData` 可见性断言（AC1-a..d 前置）；union 腿同污染被拒反证污染在场 | 三面互证，无静默假绿 | 无 |
| F-5 | 诊断记录迟到（泵异步投递） | `waitForAttemptRecords` 有界 setImmediate 轮沉降（200 轮上限，超限红） | 无竞猜、无无限等待 | 无 |
| F-6 | 对三件套的修改软化断言 | §7.6 第 3 条：修改只允许来自评审 finding 落实，且须保持矩阵覆盖/敏感性/纪律 + 重冻结 md5 记录 | 采纳政策闭环 | 无 |

正常路径不变量（恰一提交、零写入纪律、增量形态）均有断言，无以 fallback 掩盖缺口的形态。

## 9. 契约影响审查

| API or contract | Missing or weak caller handling | Evidence | Required revision |
|---|---|---|---|
| 生产 API（lease/runtime/session/诊断） | 无——生产零改动，调用方零影响 | `git diff` 空；§10 DENY 全覆盖生产面 | 无 |
| 根 vitest 发现面 | 无——两文件匹配既有 glob，无配置改动即被收集 | `vitest.config.ts` include；post-root-test.log L377/L646 实测收集（13/7 tests） | 无 |
| 宽 typecheck（`tsconfig.typecheck.json` 含 `packages/*/test/**/*.ts`） | 无——三新文件入类型检查且零噪声 | `sa6-issue437-typecheck-tests.log` `WIDE_TSC_EXIT:0` | 无 |
| 探针 | 无——探针消费 fixture（`.ts` 直引，tsx 运行），共用装置使其成为独立验证通道而非复制粘贴 | 探针 import 列表 + probe.log 32/32 | 无 |
| 未来演进调用方（改闸门/域规则/诊断 carrier/复制增量者） | 无——正是本票服务对象：判别组或不变量组红灯显形 | 基线 6 红/14 绿实测可显形性 | 无 |
| fixture 对 persistence 契约的依赖 | 无——stub 实现 `DocPersistence` 必需三成员 + 可选 `importDoc`（`importReplica` 唯一必需复制导入能力），类型面由宽 tsc 背书 | `persistence/src/contract.ts:89-101`；`WIDE_TSC_EXIT:0` | 无 |

## 10. 架构一致性与惯例审查

### 责任归属

| Behavior | Expected owner | Design location | Assessment |
|---|---|---|---|
| AC1–AC3 行为/不变量立法 | lease seam（用户可见判别联合最终形状） | §7.1 唯一观察入口 = `lease.mutateData/readData` | 正确：issue 正文指定「经 lease `mutateData`」；lease 透传（`lease.ts:392-394`）传递性覆盖全链 |
| AC4/AC5 装配 | registry（runtime/lease/session/诊断绑定的 host 级 owner） | §7.1 testing seam 装配 + §7.2 AC4/AC5 | 正确：registry AGENTS.md 确认归属；该装配面只在 registry 测试面可达 |
| 污染注入 | replication trusted raw 面（ADR 0010 哲学：零 VFSL 预校验） | §7.1 唯一经 `session.applyRemoteUpdate` | 正确：不直写 live doc；`replication-session.ts:491+` 即该面 |
| 诊断观察 | `@nomicore/namespace-diagnostic-log` 公共面 | §7.1 `createBoundedMemoryDiagnosticLog` 绑定 | 正确：只消费公共 index，零内部 subpath |

### 相似能力对照

| Similar capability | Existing implementation | Proposed design | Consistent or divergent | Reason |
|---|---|---|---|---|
| vfsl 接缝立法 | `packages/vfsl/test/issue-435-elementwise-array-*`（#435） | 不触碰、不重复（§1.2 非目标） | 一致 | 切面正交（接缝 vs lease 端到端） |
| doc-runtime 立法 | `packages/doc-runtime/test/issue-436-array-fastpath-*`（#436） | 不重复双轨/E201/S9 面（§1.2） | 一致 | #437 补的是 lease/registry 装配面（SA6 §5.1 census：lease 面 0 件——census log 复核属实） |
| registry 测试装配惯例 | `createNamespaceRegistryForTesting` + `createRegistryTestScheduler`（`testing.ts:86/126` 实锚） | fixture 同款装配 + 固定 clock + 计数 randomBytes | 一致 | 复用显式 testing surface，无平行通道 |
| 诊断包测试引用惯例 | 相对源路径 `../../namespace-diagnostic-log/src/index.js`（`registry-create-diagnostic-red.test.ts:95`、`issue-393-ndcl-self-binding-red.test.ts:59` 实锚） | fixture 同款相对引用（公共 index） | 一致（但设计给出的理由之一与 package.json 事实不符，见 O-1） | 实践与惯例一致；仅理由表述有误 |
| 读计数结构代理 | #436 `countElementReads` 先例 | `countElementReadsAsync`（窗口扩到 await 后执行时序） | 一致且有据（`write.ts:187` 时序论证） | 机器无关、不钉毫秒（ADR 决策 6） |
| 有界 setImmediate 沉降 | issue-393 既有时序纪律 | `settleUntil`（200 轮上限） | 一致 | 零 setTimeout 竞猜 |

未发现「已有扩展点可满足却新增平行通道」的形态：零新公共 API、零配置改动、零第二
wrapper；探针沿 wiki/raw 证据面惯例（#436 先例已有同位探针）。

### 单一事实源

| Fact | Authoritative source | Derived state | Drift risk |
|---|---|---|---|
| 行为期望值 | 现行实现冻结常量（域 message/path、union 仲裁 message、carrier 键集） | 无第二份推导状态 | 低——逐字冻结 + 红灯走 ADR 修订（§12），无静默同步机制 |
| 收敛/增量形态 | 机制性 oracle（同基态重放、空 doc 不物化、diff 定点、A/B 对照） | 无 | 低——oracle 是构造性判定，非镜像状态 |
| 污染在场性 | live doc（经 `readData` 观察） | 无 marker/镜像 | 低——写前断言 + union 反证 |

### 生命周期对称性

| Start or acquire | Stop or release | Failure recovery | Assessment |
|---|---|---|---|
| `registry.open` → lease → session/诊断绑定 | 测试进程退出（无显式 close；fake scheduler 零真实 timer，无泄漏面）；既有 5/50 文件显式 close 亦非包内强制惯例 | 夹具断言 fail-loud（`assert` throw 即红） | 可接受；§8 L1 措辞修正建议见 O-3 |

### 平行机制检查

| Candidate duplicate | Existing path | Proposed path | Disposition |
|---|---|---|---|
| 第二评论读取路径 / API wrapper / cleanup worker / 重试循环 | 无（不存在亦不需要） | 无新增 | 无平行 |
| 测试侧第二断言库 | vitest `expect`（测试文件）/ 本地 `assert`（fixture，零 vitest 依赖） | 同款 | 有意分层：fixture 供探针（tsx）与两侧共用——非平行而是单一装置双通道消费 |
| 探针 yjs 载体 | fixture/registry 内 `yjs` | 探针经 `packages/namespace-registry/node_modules/yjs/dist/yjs.mjs` 直取（symlink 归一取同一模块实例） | 可接受（文件内注释说明动机：Yjs 结构类型需模块实例同一；探针是证据件非测试交付物）；观察 O-4 |

## 11. 文件范围审查

| Path or scope issue | Evidence | Required revision |
|---|---|---|
| ALLOW LIST 7 项与正文涉及路径一一对应，无未列路径 | 正文实现性引用仅：三件套 + 探针 + `wiki/raw/` 产物 + artifacts；§9 证据命令只读 | 无 |
| ALLOW 无无理由扩张；三件套/探针标注「采纳冻结件（已在位）」+ md5 复核政策（§7.6） | 四件 md5 与 SA6 §16 逐件一致（SA2 复核） | 无 |
| DENY LIST 与正文无冲突：`packages/*/src/**`（doc-runtime/vfsl/namespace-runtime/namespace-registry/namespace-diagnostic-log）、`issue-435/436` 既有测试、ws 线级面、规范面（docs/adr、CONTEXT.md）、发现/类型/依赖配置 | 实测 `git diff` 空、`git status` 仅 untracked 新增（测试三件 + 探针 + wiki 四件 + artifacts 日志）——DENY 全部未被触碰 | 无 |
| fixture 的 `../../namespace-diagnostic-log/src/index.js` 相对引用是否越界 | 引用（非修改）他包公共 index；registry 测试面既有惯例两处实锚；宽 tsc + 根测试绿 | 无 |
| follow-up 未掩盖本任务必要项 | 残余四项（线级烟测、并发、大 n、noop 的 vfsl 归属）均明示票外且各有归属/依据（ADR 决策 6、#435 B6、SA6 §15） | 无 |

## 12. 验收设计审查

| Requirement or risk | Proposed evidence | Gap | Required revision |
|---|---|---|---|
| AC1（判别组防恒真） | A/B 闸门对照（同夹具/同污染/同 op，仅声明类型不同）+ 旧实现 `7407ce0` 基线实测红（AC1-a..e，红因逐字 = legacy 全量判决）+ 探针独立通道（P1e/P1f） | 无——三层敏感性证据齐备；基线选择论证正确（`7407ce0` = #435 已合 #436 未合，恰为「行为变化未在 lease 生效」面；更早提交会混入接缝缺失红因） | 无 |
| AC2-d/C7（性能路径结构锚防机器相关） | live 元素读计数（`get/toArray/forEach`），fast ≤8 / legacy ≥n（n=64），零计时阈值；HEAD 实测 0 vs 191 | 无 | 无 |
| AC4（形态防值相等伪证） | carrier 键集 + 同基态重放 + 空 doc 不物化（整文档编码反证）三面 | 无 | 无 |
| AC5（防租约读路径自证） | 纯 Y.Doc 重放 / peer apply / diff 定点三通道独立 | 无 | 无 |
| 旧实现真红（非伪绿/非环境） | 基线同 command 14/20 绿（含全部负控与不变量组）+ 红集 3 轮 md5 稳定 + 根 typecheck exit 0 | 无 | 无 |
| 测试观察行为而非源码文本 | 冻结三件 sweep：零 `readFileSync`/源码字符串断言、零 skip/only/todo、零 env 分支、零吞错 catch | 无 | 无 |
| 建议测试落在真实入口 | 根 `pnpm test` 实测收集两文件（L377/L646，13/7 tests）；`pnpm typecheck` + 宽 tsc 双绿 | 无 | 无 |
| AC6 判据抗计数漂移 | §9 注：验收判据 = 全绿 + 两文件被收集，不钉绝对计数 | 无 | 无 |
| 每条 AC → 最高 seam 证据 | AC1/2/3 → lease `mutateData/readData` 判别联合与逻辑值；AC4 → 诊断记录（registry 装配的最高可观察面）；AC5 → session 公共面（AC 措辞「经 replication apply」即此面）+ 三通道字节 oracle；AC6 → 根 gates | 无——lease 是本仓用户可见判别联合的最终形状面（`lease.ts` 透传），其上无更高级公共 seam；线级面已被 ADR 0033「协议零改动」+ AC 措辞双重排除 | 无 |

## 13. Required revisions

无 BLOCKER / MAJOR finding。空表。

| Finding ID | Severity | Evidence | Problem | Required change | Acceptance |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## 14. Non-blocking observations

- **O-1（MINOR，设计 §7.7 理由性表述与事实不符）**：「依赖层 registry 不依赖
  diagnostic-log 包名」不成立——`packages/namespace-registry/package.json` 的
  dependencies 明确含 `"@nomicore/namespace-diagnostic-log": "workspace:*"`。
  冻结 fixture 的**实践本身**（相对源路径引用该包公共 index）与既有惯例两处实锚
  （`registry-create-diagnostic-red.test.ts:95`、`issue-393-ndcl-self-binding-red.test.ts:59`）
  一致且类型/运行双绿，故不影响交付物安全；建议 SA3 在实现 notes（或后续设计修订）
  中更正该句理由（如改为「沿 registry 测试面既有惯例，直引源码 index 以取
  nomicore-source 条件下的源码形态」），不动三件套本身。
- **O-2（MINOR，矩阵排序与实物声明序不一致）**：§7.2 矩阵 AC2 行排序 a/b/c/d，
  冻结契约文件实际声明序 a/b/b 后 d 再 c（AC2-d 先于 AC2-c）。各 test 独立夹具、
  无依赖，语义零差；纯文档排序差异，无需改文件。
- **O-3（MINOR，§8 L1 清理列措辞）**：「fixture 生命周期随 registry 关闭」——测试
  并未显式 close/shutdown registry（生命周期交由进程退出）。与包内主流惯例一致
  （50 个既有测试文件仅 5 个显式 close）、fake scheduler 零真实 timer 无泄漏风险；
  建议措辞改为「fixture 生命周期随测试进程结束；受控 scheduler 零真实 timer」。
- **O-4（MINOR，探针载体直取路径）**：探针经
  `packages/namespace-registry/node_modules/yjs/dist/yjs.mjs` 取 yjs 模块实例（文件内
  注释已说明动机：symlink 归一保证 Yjs 结构类型模块实例同一）。该路径对依赖布局
  变化敏感，但探针是冻结证据件而非测试交付物、不在发现面；仅需在复跑探针失败时
  先检查依赖布局。

## 15. 结论

设计把「ADR 0033 已实现、lease seam 零回归锚」这一能力缺口转化为可执行、可判别、
防伪绿的立法方案：观察面选择正确（issue 指定的 lease seam；registry 为 AC4/AC5 的
唯一装配面）、判别组有旧实现实测背书（6 红/14 绿，红因逐字正确）、冻结采纳基线的
指纹逐件复核一致、test-only 约束实测成立、文件范围与仓库惯例（testing seam、诊断
相对引用、证据面落位）一致。无阻断 finding；4 条 MINOR 观察不构成实施风险。
本评审未发现需要重新执行 ADR 冲突检查的新风险（设计 §13「否」的结论成立）。
