# SA7 Final Dynamic Verification — issue #388：谓词订阅与宁多勿漏判定（变更订阅 T2）

- 角色：SA7（数据流与状态机动态验证者）；dispatch：`sa-d155b0f9-bcfb-4daa-88a3-e529e66c649c`（iteration 0，final-verification）
- 验证对象：worktree `/home/wangjian/nomicore-fix-issue-388`（branch `mabf/issue-388`，HEAD `28faeae`）**未提交实现**
  （7 个 `src` 修改 + 3 个契约测试文件——SA3 落盘、SA4 `approve` 的同一变更集）
- 上游相位：SA4 实现评审 **approve**（0 BLOCKER / 0 MAJOR / 4 MINOR）；SA8 实现后冲突门 `clear`
  （`requiresConflictRecheck = false`）；SA6 契约 `approve`；设计 F-1–F-6 冻结
- Owner feedback 快照：**空**（无 owner 要求 / comment ID / updated_at——与 SA6/SA8/SA3/SA4 四方独立同口径）；
  需求源 = issue body AC1–AC8 + ADR 0030 决策 2/3/5
- 本轮零生产实现改动、零契约文件改动；唯一新增面 = 临时动态探针（已删）+ 证据日志 + 本报告
- **结论：`approve`** —— 设计声明改变的数据流全部按设计变化、声明保持的路线全部保持、状态机与关键值正确、
  禁止状态未出现、错误与清理符合设计、临时诊断已安全清理（§Verdict）

---

## 1. Inputs

| 输入 | 用途 | 状态 |
|---|---|---|
| `wiki/raw/task_issue-388.md` | Host brief：AC1–AC8 | 在场（35 行） |
| `wiki/raw/task_issue-388_design.md` | 实现绑定：§8.2 门⑥、§8.3 判定算法、§8.4 数据流路线表（4 条）、§8.7 生命周期、F-1–F-6 | 在场（670 行） |
| `wiki/raw/task_issue-388_sa6_contract.md` | 验收契约：B-1–B-10、N1–N15/E1–E11、§12.5 断言纪律、§12.6 红线 | 在场（500 行） |
| `wiki/raw/task_issue-388_sa3_impl.md` | 实现自述 + 验证证据链 | 在场（150 行） |
| `wiki/raw/task_issue-388_sa4_review.md` | 实现评审（approve）+ §11 后续动态验证项（本轮逐项裁处，见 §8 矩阵） | 在场（227 行） |
| `wiki/raw/task_issue-388_conflict_report.md` / `_implementation_conflict_report.md` / `_relevant_decisions.md` | SA8 前置/实现后门禁与冻结面（协议边界识别） | 在场 |
| 实现 diff（`git status --porcelain` + 逐文件实读） | 被验证对象：`watch-map.ts`（831 行，门⑥ a–d + `predicateKeepsContainerChange` + 逐 key try/catch）、`errors.ts`（append-only 新码）、`runtime.ts`/`lease.ts`/`types.ts`（三参加宽 + Equal 锁）、两包 `index.ts`（type-only +2） | 在场 |
| 契约三件套（fixture 433 / 行为 851 / surface 164 行） | 动态驱动复用面（本轮全部重跑） | 在场 |
| `artifacts/sa3-issue388-verify-*.log`、`sa6-issue388-*.log` | 上游证据（基线/红绿）——仅实读核对，不作为本轮动态证据 | 在场 |

## 2. Runtime environment

| 项 | 值 |
|---|---|
| 环境 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；typescript `5.9.3`；`maxWorkers: 1` |
| Worktree | `/home/wangjian/nomicore-fix-issue-388`（branch `mabf/issue-388`，HEAD `28faeae` + 未提交实现） |
| 安装 | 沿用 SA6 `pnpm install --frozen-lockfile` 产物（`node_modules` 在场，本轮零依赖变动） |
| 运行形态 | 全部为有限时长进程内 vitest 运行（`NODE_OPTIONS=--conditions=nomicore-source`）；零网络、零外部服务、零后台常驻、零端口占用 |
| 临时诊断 | `[SA7-DATAFLOW]` 前缀临时探针 ×2（详见 §6，均已删除） |

## 3. Changed Data Flow Verification

设计 §8.4 声明 4 条路线（建立流 / 通知流谓词过滤 / 旧态快照边界 / 谓词编译快照）+ 通知流三触发源
（本地受控写 / raw 事务 / 复制 apply）。逐条以运行时驱动观察关键跳点（不只看最终返回值）：

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| 建立流（§8.4-1） | `lease.watchMap(path, listener, options)` → released 短路 → runtime 门①–⑤ 原序 → **⑥ 谓词门（a 敌意形状 → b 词形 → in 空数组 → c 纯 schema 解析 → d 编译冻结）→ ⑦ 登记**；失败同步 throw `WATCH_MAP_OPTIONS_INVALID`、零登记 | 探针 P1 + 契约 E1–E11 重跑 | ① 门②（listener 形状）先于门⑥：非法 listener + 非法谓词 → `TypeError`（非 `WatchMapError`）；② 非法谓词（field 不存在）→ 同步 throw `code='WATCH_MAP_OPTIONS_INVALID'` 经 lease 面上抛；③ 失败零登记：后续非匹配 add 零到达（无死订阅回声）；④ 簿记不损伤：失败调用后合法谓词订阅照常建立并收通知；⑤ 六 cause message 互相可区分、码前缀、零回显（E11）；⑥ 更早门先抛：released / 无 active schema / 非法 path + 非法谓词 → 既有码（E8） | 门次序不回退；失败零登记零 observer 变更；六 cause 同码异 message | 全部一致（P1 四跳点 + E1–E11 29/29 绿） | ✅ |
| 通知流·谓词过滤（§8.4-2） | `collectChanges` 逐 key：T1 真变判定（前置不动）→ §8.3 谓词层（C-1 add/update/delete 精确或保守、C-2 恒保守、逐 key try/catch → 保守）→ 队列/泵/载荷零改动 | 契约 N1–N15 重跑 + 探针 P3（同事务双订阅） | ① 同一 raw 事务内：无谓词订阅收 `['t9','t10']`、谓词订阅恰 `['t9']`——过滤发生在逐订阅通知推导层，事件面未被改写；② 同事务同 key 两次写合并为单定位符、一事务一通知（两订阅同构）；③ origin 投影 `local`；④ 契约行：N1/N2（C-2 保守通知）、N3/N4（退出/进入匹配集通知）、N5（同值写零通知）、N6（live 整替保守）、N7/N8（add 精确静默/逐 key 剔除）、N9/N9b（plain 快照精确静默）、N10/N10b（plain 两态通知）、N11（缺失/null 恒不匹配按载体分档）、N12（in 集合语义逐字节同构）、N12b（SameValue） | 谓词只改「是否通知」与 `changes` key 集合；宁多勿漏合取式逐行成立 | 全部一致（29/29 绿 + P3 通过） | ✅ |
| 通知流·复制 apply 触发源（§8.4-2；T1 D8 无过滤） | 任意 ROOT 事务（含复制 apply）无 origin 过滤；per-session symbol origin → 投影 `'replication'`；判定与本地路径同矩阵分档 | 探针 P4（远端 doc 差分 + `Y.applyUpdate(doc, diff, symbol)`——与 `replication-session.ts` L425/L764 同调用形） | R1 匹配条目嵌套写（C-2）→ 谓词/无谓词订阅均通知 `[t2]` 且 `origin='replication'`；R2 非匹配 add → 谓词精确静默、无谓词订阅收 `[t12]`（replication）；R3 plain 条目整值替换（非匹配→非匹配，oldValue=plain 快照）→ 谓词精确静默、无谓词订阅收 `[t3]`（replication）；R4 plain `closed→open` 进入匹配集 → 谓词通知 `[t3]`（replication）；屏障保守通知到达；全程 kind 恒 `data`、全部通知 origin 恒 `replication`（两容器四订阅同投影） | 复制路径判定与本地路径不分叉；origin 只作分类字段 | 全部一致（P4 通过；含 raw 事件形状旁证 `t3:update origin=symbol`） | ✅ |
| 旧态快照边界（§8.4-3） | `isPlainData(oldValue)` 分流：plain 快照 → 两态可读精确；live Y 载体（Yjs 清空内容）→ 不可判保守 | 契约 N6/N9/N9b/N10 重跑 + 探针 P4 R3/R4（复制驱动的 plain 快照面） | live 整替（N6）通知；plain 替换两非匹配态零通知（N9、P4-R3）；plain 进入匹配集通知（N10、P4-R4）；plain delete 旧态匹配通知 / 非匹配静默（N10b/N9b） | 精确/保守两分支按事件形状落位 | 全部一致 | ✅ |
| 谓词编译快照（§8.4-4；⑥-d） | 编译深冻结快照，**绝不保留调用方对象/数组引用**；存续期判定恒定 | 探针 P2（建立后变更调用方对象） | ① 建立后整体替换 `options.where`（field→title）：新谓词本应命中的条目（title 匹配、status 不匹配）仍按原谓词静默；② 建立后向 `in` 调用方数组 `push('done')`：done 条目仍静默（匹配集未放宽）；③ 两形态屏障通知均恰 1 条 | 判定语义在存续期恒定于建立期编译值 | 全部一致（P2 通过） | ✅ |

无跨进程/持久化数据流变化（设计 §8.4 收口）：本轮动态面零接触复制 wire、持久化与诊断日志——
registry 包全量重跑（42 文件 / 525 用例，§5）作为冻结面健康旁证。

## 4. Preserved Data Flow Verification

设计声明不变的路线（T1 冻结面 + SA8 §5），基线 = SA6 §4/§6 负控（T1 21/21、registry 41/496、
门次序 P2/P5/P6、同值写 R5=0、读面在产），本轮全部复验：

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| T1 无谓词形态 | 省略 options / `undefined` / `{}` / `{where:undefined}` → 无谓词全通知，逐字不变 | 契约 E10 + T1 三件套重跑 + 探针 P3 对照订阅 | T1 21/21 + 2 类型（SA6 基线） | T1 23/23（21 行为 + 2 类型，Type Errors no errors）；E10 四形态全通知；P3 无谓词订阅收全量 key | ✅ |
| 同值写零通知 | 载体 delta 在、投影值未变 → T1 真变判定前置过滤（谓词不复活） | 契约 N5 | R5=0（SA6） | N5 绿（29/29 内） | ✅ |
| 通知载荷 | `data` 恰三键、定位符恰两键、JSON 不含值、kind ∈ 三 kind 闭集 | 契约 N13 + 探针 P3/P4/P6 kind 断言 | 三键/两键形状在产（SA6） | N13 绿；探针全程 kind 恒 `data`（零 error kind、零提前 `watch-end`） | ✅ |
| 一事务一通知 / FIFO / 首见序去重 | 每订阅每事务至多一条 data；同 key 合并 | T1 B1/B2 + 探针 P3 | T1 绿（SA6） | T1 21/21；P3 同 key 两写合并、一事务一通知（谓词/无谓词两订阅同构） | ✅ |
| origin 分类无过滤 | null → `local`；symbol → `replication`；不按来源过滤 | 探针 P3（raw 本地）/ P4（symbol apply） | T1 分类在产 | local 与 replication 两态投影各自恒定；复制路径判定与本地同分档（§3 行 3） | ✅ |
| 读面 / 窗口读 / 键集 | readData 恒四键（集中化 helper）、`readMap` 在产、`WINDOW_CARRIER_MISMATCH` 零改动、lease 恰 16 键 | 契约 NC 行 + registry 包全量 | SA6 NC2 绿 | NC 行绿；registry 包 42 文件 / 525 用例全绿（基线 41/496 + 本票行为契约 1 文件/29 用例） | ✅ |
| 槽外异步分发 / 回调隔离 | 投递移出事务栈与写序列器槽；listener throw 静默隔离 | T1 D1/D2/X1 重跑 | T1 绿 | 21/21 绿（含 D1 同步段零回调、D2 槽外、X1 隔离） | ✅ |
| 生命周期 | 退订幂等零回声；lease 释放清理订阅；runtime close 防御收口 | 契约 N14 + T1 L1/L2 | T1 绿 | N14 绿（幂等 + 释放清理零悬空回调）；T1 L1/L2 绿 | ✅ |
| 调用面兼容（ws-replication testing 门面 / 9 替身 / 4 键审计） | `.bind` 保形加宽、少参实现恒可赋值、键集与加宽正交 | registry 包全量（含替身与键审计行）；root 面由 SA3 实跑（396 文件 / 4785 用例 + typecheck exit 0） | SA3 root test 全绿 | registry 包本轮全绿；root 面零代码变动（SA7 零生产改动），SA3 证据持续有效 | ✅ |

## 5. State Machine Verification

建立状态机（全同步、次序冻结）与通知/退订/清理时序：

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| ready lease（active schema ready） | `watchMap(合法 path, 函数, 合法谓词)` | ①–⑤ → ⑥a→b→c→d → ⑦ 登记；返回恰 `{unsubscribe}` 冻结句柄 | E1–E3 建立成功（29/29 内）；P1 合法建立后正常收通知 | 部分登记/半编译态未出现（失败路径全部 throw 先于 `subscriptions.add`——E4/E6 零登记佐证行） | ✅ |
| ready lease | 非法 listener（+ 非法谓词在场） | 门② `TypeError`；零登记 | P1：抛 `TypeError`（非 `WatchMapError`）——门② 先于门⑥ | 谓词门先抛 / 静默建立未出现 | ✅ |
| ready lease | 非法谓词（六 cause：options 形状 / where 词形 / in 空数组 / field 不存在 / 条目无统一值域 / 非标量域） | 门⑥ 同步 throw `WATCH_MAP_OPTIONS_INVALID`（同码异 message、门内子序冻结）；零登记 | E4–E7/E5b/E11 绿；P1 跳点②③④（零登记 + 簿记不损伤） | 静默建立（ADR L85 死订阅形态）未出现 | ✅ |
| released lease / 无 active schema / 非法 path | 非法谓词同场 | 更早门既有码（`NAMESPACE_LEASE_RELEASED` / `WATCH_MAP_SCHEMA_UNAVAILABLE` / `WATCH_MAP_CARRIER_MISMATCH`） | E8 绿（门次序不回退） | 次序回退（谓词门抢跑）未出现 | ✅ |
| 已登记订阅 | 任意 ROOT 事务（本地/raw/复制 apply） | 入队 → 单飞微任务泵 → 20 微任务让步后投递；一事务一通知 | P3/P4 各事务恰一条通知按序到达；T1 B2 FIFO 绿 | 事务内同步回调 / 双通知未出现（T1 D1 + P3） | ✅ |
| 已登记订阅（已入队未投递） | 同步段内 `unsubscribe()`（含重复调用） | 清空在队通知；泵下一让步点退出；零投递；幂等零 throw | P5：witness 订阅送达后 gone 订阅仍 0 条；双退订零 throw | 迟到回调 / 退订后回声未出现 | ✅ |
| 已退订 | 同 lease 再建立谓词订阅 | 新订阅独立工作 | P5：再建立后匹配 add 照常通知（恰 1 条） | 簿记损坏 / 旧句柄复活未出现 | ✅ |
| 已登记订阅 | lease `release()` | 释放清理订阅，零悬空回调 | N14 绿（释放后写入零回声；跨 lease 对照） | 释放后回声未出现 | ✅ |
| 已登记订阅（数据偏离 schema） | raw 标量条目值 / 字段值对象 + 后续合法写 | 求值不抛、写结果不变、零 error kind、订阅存活 | P6：raw 偏离写不 throw；受控写 ok；匹配 add 屏障照常通知；N15 绿 | error kind / 写 fatal / 订阅死亡未出现 | ✅ |
| 通知流 | 全部场景 | kind ∈ 三 kind 闭集；T2 零 `watch-end`（终结编排属 T3 #389） | P3/P4/P6 全程 kind 恒 `data`；契约 E6/N13 闭集断言绿 | 提前 `watch-end` / 参数错误 kind 未出现 | ✅ |

## 6. Error and Cleanup Flow

- **建立失败（六 cause）**：同步 throw、失败路径零订阅登记、零 observer 变更——动态证据 = E4–E7/E5b
  （零登记佐证行）+ P1 跳点③（失败调用后无死订阅回声）与跳点④（后续建立不受影响）。部分完成不存在：
  throw 先于 `subscriptions.add`，无半登记态可观察。
- **既有订阅不受失败调用影响**：P1 跳点③——同一 lease 上失败建立前后，合法谓词订阅的通知序列恰为
  匹配 add + 屏障（无丢失、无多余）。
- **求值期数据异常**：设计判定面零 throw（`readMemberScalar` 全量分类）；P6 以真实偏离数据（raw 标量
  条目值 / `status` 字段值为对象）驱动——不抛、受控写结果不变、订阅存活、零 error kind。设计内「逐 key
  try/catch → 该 key 保守」的真实 throw 注入需 mock/调试器（SA4 §11-3 同判），T4 #390 testing 注入位承接。
- **cleanup 时序到 quiescence**：退订清队在队通知并在泵下一让步点退出（P5，零投递）；重复退订幂等（P5/N14）；
  lease 释放清理全部谓词订阅零悬空回调（N14）；无重启/重试复活旧路径面（谓词随订阅对象回收，退订后
  零回声、再建立为新订阅——P5）。
- **进程清理**：全部运行为有限时长 vitest 进程；零 nohup/setsid/PID 文件/端口占用/后台残留
  （`job_output` 全部结算，exit 0）。

## 7. Temporary Diagnostics

| 项 | 内容 | 处置 |
|---|---|---|
| 添加项 1 | `packages/namespace-registry/test/sa7-tmp-dataflow-probe.test.ts`（6 探针 P1–P6，`[SA7-DATAFLOW]` 前缀；覆盖门机跳点/编译快照/双订阅过滤/复制 apply/退订时序/偏离数据清理） | **已删除**（最终运行 6/6 绿，日志留存 `artifacts/sa7-issue388-probe.log`） |
| 添加项 2 | `packages/namespace-registry/test/sa7-tmp-debug.test.ts`（一次性 Yjs 事件形状调试：复制 apply 下 `plainTasks` 容器 `t3:update origin=symbol` 旁证） | 运行后立即删除 |
| 迭代记录 | 探针经 3 轮修正：① 严格模式索引访问（临时文件进入 typecheck 程序报 4 处 `Object is possibly 'undefined'`——被并跑的 surface 运行以 exit 1 显形，测试本身 3/3 通过）；② P4 容器订阅错配（R3/R4 改 `plainTasks` 但订阅挂在 `tasks`）——纯探针 bug，调试运行证实机制本身在产；③ 一处断言形状笔误。全部为探针侧问题，非产品缺陷 | 最终 6/6 绿后删除 |
| 移除后复跑 | 行为契约 **29/29**（`sa7-issue388-postremoval-behavior.log`）、surface **3/3 + Type Errors no errors**（`-postremoval-surface.log`）、T1 行为 **21/21**、T1 surface **2/2 + no errors**、registry 包 **42 文件 / 525 用例**（`-registry-package.log`）——与移除前一致，结果不依赖临时诊断 | ✅ |
| 残留核对 | `git diff` 零 `[SA7-DATAFLOW]`；`grep -rn SA7-DATAFLOW packages/` 零命中；worktree 恢复 SA3 变更集原状（7 M 源文件 + 3 新契约文件，`git status --porcelain` 复核） | ✅ |
| 保留证据 | `artifacts/sa7-issue388-*.log` 8 份（见 §9）；临时测试文件不进 artifactPaths | ✅ |

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA6 §5 证据1 / §13-1 | 建立判定：六种非法谓词形态 HEAD 静默建立（首红位） | 契约 E4–E7/E5b/E11 重跑 + P1 | 同步 throw `WATCH_MAP_OPTIONS_INVALID`、零登记、六 cause 可区分零回显 | 全部 throw 同码异 message；零登记佐证绿 | `-behavior.log` / `-postremoval-behavior.log` / `-probe.log` | pass | — |
| SA6 §13-2 | 精确降噪首红行 N7/N8/N9（HEAD 多通知） | 契约 N7/N8/N9/N9b 重跑 | 零通知 / 恰 `[t9]` / plain 快照静默 | 逐行绿 | 同上 | pass | — |
| SA6 §15-1 / 设计 F-1 | AC7 保守分支粒度（N2/N6 必须通知） | 契约 N1/N2/N6 重跑 | C-2 嵌套与 live 整替保守通知 | 绿 | 同上 | pass | — |
| SA6 §9-3（W1/W2） | 旧态不可判两来源（嵌套浅 delta / live oldValue 内容清空） | 契约 N6/N9 对偶行 + P4 R3/R4 | live 保守、plain 精确 | 两分支按事件形状落位 | 同上 | pass | — |
| SA6 §12.5-3 | 等待纪律（poll + 屏障，禁 sleep） | 全部驱动复用 `NotificationSink.waitForCount` + 屏障事务 | 送达/零通知表达确定 | 全绿无竞猜 | fixture/契约源 | pass | — |
| SA4 §11-2 | 谓词订阅在复制 apply 事务下的判定与 origin 投影 | **P4**（新增动态面） | 判定同矩阵分档；origin `'replication'`；无 origin 过滤 | R1–R4 四分档全一致；四订阅 origin 恒 replication | `-probe.log` | pass | Hub/Peer 会话级验收仍属 T3 #389 |
| SA4 §11-3 | 逐 key 求值异常保守收编（fault-injection） | P6 + 契约 N15（数据偏离面） | 不抛、写不变、订阅存活 | 绿；真实 throw 注入需 mock（设计判定面零 throw） | `-probe.log` / `-behavior.log` | pass（注入位） | T4 #390 testing 注入 |
| SA4 §11-5 | schema 替换后谓词订阅沿用编译谓词 | 本轮未驱动 | 按建立期谓词继续判定 | 未验证（设计 §8.7 声明、终结编排属 T3 非目标面） | — | 范围外 | T3 #389（watch-end） |
| SA4 O-A/O-B/O-C/O-D（MINOR） | oracle 固化 / union 全标量子情形 / throwing-Proxy 子情形 / Symbol 键非形状通道 | SA4 已裁不阻断；本轮无新增证据 | — | 维持 SA4 裁处 | SA4 §12 | noted | 后续票可选增补 |
| Design §8.2/§8.4 | 门⑥ 位置与子序、谓词编译快照纪律、门② 先于门⑥ | **P1/P2**（新增动态面） | 次序冻结；不保留调用方引用 | 全部一致 | `-probe.log` | pass | — |
| Design §8.4 触发源三来源 | 本地受控写 / raw 事务 / 复制 apply 均可达判定 | 契约（受控写 + raw）+ P3（raw 双订阅）+ P4（复制 apply） | 三来源同判定路径 | 一致 | `-behavior.log` / `-probe.log` | pass | — |
| Design §8.7 / SA8 冻结面 | 生命周期零新状态、读面/窗口读/复制 wire/诊断零接触 | T1 三件套 + registry 包全量 + N14 | 全部保持 | 23/23 + 42 文件/525 用例绿 | `-t1-*.log` / `-registry-package.log` | pass | — |

额外发现：**零**（本轮未发现实现偏离设计的新 finding；探针迭代均为探针自身缺陷，见 §7）。

## 9. Commands and Evidence

| # | Command | Result | Evidence（worktree-relative） |
|---|---|---|---|
| 1 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/namespace-registry/test/issue-388-watch-map-predicate-red.test.ts --typecheck.enabled=false` | **29/29 passed**，exit 0（移除前后各一次） | `artifacts/sa7-issue388-behavior.log` / `artifacts/sa7-issue388-postremoval-behavior.log` |
| 2 | `… npx vitest run --typecheck packages/namespace-registry/test/issue-388-watch-map-predicate-surface.test-d.ts` | **3/3 passed，Type Errors: no errors**，exit 0 | `artifacts/sa7-issue388-surface.log` / `artifacts/sa7-issue388-postremoval-surface.log` |
| 3 | `… npx vitest run packages/namespace-registry/test/issue-387-watch-map-tracer-red.test.ts --typecheck.enabled=false` | **21/21 passed**，exit 0 | `artifacts/sa7-issue388-t1-behavior.log` |
| 4 | `… npx vitest run --typecheck packages/namespace-registry/test/issue-387-watch-map-lease-surface.test-d.ts` | **2/2 passed，Type Errors: no errors**，exit 0 | `artifacts/sa7-issue388-t1-surface.log` |
| 5 | `… npx vitest run packages/namespace-registry --typecheck.enabled=false` | **42 文件 / 525 用例全绿**，exit 0（基线 41/496 + 本票契约 +1 文件/+29 用例） | `artifacts/sa7-issue388-registry-package.log` |
| 6 | 临时探针 `sa7-tmp-dataflow-probe.test.ts`（P1–P6；`--typecheck.enabled=false`） | **6/6 passed**，exit 0（文件已删，日志留存） | `artifacts/sa7-issue388-probe.log` |
| 7 | `git diff \| grep -c SA7-DATAFLOW` / `grep -rn SA7-DATAFLOW packages/` | **0 / 0**（零残留） | §7 表 |
| 8 | `git status --porcelain` | 恢复 SA3 变更集原状（7 M + 3 ?? 测试 + wiki/artifacts 未跟踪） | §7 表 |

## 10. Deviations

1. **探针迭代（非产品缺陷）**：P4 探针首轮两处探针侧 bug（容器订阅错配、断言形状）+ 严格模式索引访问，
   3 轮修正后 6/6 绿；期间一次 surface 并跑 exit 1 系临时文件进入 typecheck 程序（被测契约本身 3/3 通过），
   删除后 exit 0——已在 §7 诚实记录并复核。
2. **复制 apply 驱动层级**：P4 在 Yjs 层以 `Y.applyUpdate(doc, diff, per-apply symbol)` 复现复制 apply
   路由（与 `replication-session.ts` L425/L764 同调用形、同 origin 分类跳点）；Hub/Peer 会话级
   `'replication'` origin 验收断言属 T3 #389（设计非目标），未越界搭建复制拓扑。
3. **root 全仓门未重跑**：SA7 只做聚焦动态验证；root `pnpm typecheck`（14 tsconfig exit 0）与 root
   `pnpm test`（396 文件 / 4785 用例全绿）沿 SA3 实跑证据——本轮零生产代码/契约文件改动，该证据持续有效。
4. **schema 替换后延续语义未验证**：设计 §8.7 声明 T2 订阅在 schema 变更后沿用建立期编译谓词、终结编排
   属 T3 #389（SA4 §11-5 同裁）——按设计非目标边界不驱动，记入 §8 路由。

## Verdict

**`approve`** —— SA4 已 pass 基础上的独立动态验证未发现任何 fail：

1. **Changed**：设计 §8.4 四条路线（建立流门⑥ / 通知流谓词过滤 / 旧态快照边界 / 谓词编译快照）按设计变化，
   关键中间跳点均有运行时证据（门②→⑥ 次序、零登记、编译快照不受调用方变更影响、双订阅同事务过滤、
   复制 apply 判定同分档 + origin `replication`）；
2. **Preserved**：T1 无谓词形态逐字不变（23/23）、同值写零通知、载荷三键/两键、一事务一通知/FIFO、
   origin 无过滤、readData 四键/窗口读/lease 16 键、槽外分发、生命周期清理全部保持（registry 包 42/525）；
3. **State machine**：建立门机次序冻结、失败零登记、退订清队零迟到投递、释放清理、再建立正常；
   禁止状态（静默建立死订阅、门次序回退、退订/释放后回声、error kind、提前 `watch-end`）全部未出现；
4. **Error/cleanup**：六 cause 同步 throw 零登记、偏离数据零 throw 写不变订阅存活、cleanup 到 quiescence；
5. **临时诊断**：探针已删、移除后复跑结果不变、`git diff` 零 `[SA7-DATAFLOW]` 残留。

SA7 不承担 push/PR/CI 裁决；root 全仓门沿 SA3 证据，CI 分片实跑属总控后续相位。
