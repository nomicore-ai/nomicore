# SA7 动态验证报告 — issue #364（T2 readData 投影文本化原子切换）

- 角色：SA7（Dynamic Verifier）· dispatch `sa-0f253406-6cf0-45a8-a296-6e9c5d0ae70f` · phase final-verification · iteration 0
- 验证对象：SA3 iteration 1 工作树未提交实现（基线 HEAD `f8a06fe`，分支 `mabf/issue-364`；28 modified + 5 untracked 测试文件）
- 上游裁决：SA4 review **approve**（无 BLOCKER/MAJOR）；SA8 实现后复查 clear。SA7 在此基础上独立动态验证，未下调 SA4 verdict，也未发现独立 fail。
- 验证方式：只读复跑既有契约 + 独立探针（自造 fixture + 独立 oracle）+ SA6 §12.11 突变全表 M1–M8（临时改实现→跑契约→sha256 还原）。**最终未修改任何实现/测试/文档**（除本报告）。

## 1. Inputs

| 输入 | 状态 | 用途 |
| --- | --- | --- |
| `wiki/raw/task_issue-364.md`（Host brief） | 在场 | What-to-build 5 条 + AC 10 条 |
| `wiki/raw/task_issue-364_sa6_contract.md`（approve） | 在场 | CT-1..CT-10、附录 A/B/C、U1–U7、§12.11 M1–M8（SA7 指定执行项） |
| `wiki/raw/task_issue-364_design.md`（SA1） | 在场 | §7-D1..D9、§8.3 数据流 R1–R4、§11 ALLOW/DENY |
| `wiki/raw/task_issue-364_sa3_impl.md` + 9 份证据 log | 在场 | 实现报告与红→绿→门禁证据链 |
| `wiki/raw/task_issue-364_sa4_review.md`（approve） | 在场 | §11 后续动态验证项（M2–M8、released 生命周期、原型污染隔离） |
| `wiki/raw/task_issue-364_relevant_decisions.md` / `_conflict_report.md` / `_implementation_conflict_report.md`（SA8，clear） | 在场 | 协议边界（冻结面、W1–W4） |
| `docs/adr/0027`、runtime/registry AGENTS、实现源码 5 文件 | 实读 | 权威契约与验证对象锚点 |
| Issue #364 REST comments | 空（dispatch 明示 none） | 无 owner 逐字判据 |

## 2. Runtime environment

```
node v24.13.0 · pnpm 10.28.2 · vitest 3.2.7 · TypeScript 5.9.3
HEAD f8a06fea4285a61bf0f48570b0269d47dfa03fb0（分支 mabf/issue-364）
依赖已离线装齐（SA6 §4 起 store 复用；本轮零安装）
vitest 拓扑：默认 forks pool + isolate、maxWorkers: 1（原型污染用例文件级隔离的事实基础）
进入本验证时五生产文件 sha256 快照（突变还原的比对基准）：
  read-schema-projection.ts 87f9cb42…  runtime.ts 8452c7d8…（= SA3 M1 还原记录值）
  index.ts 6ed2ccdd…  registry/types.ts 68f7f1a7…  registry/lease.ts 760984c9…
```

无服务、无端口、无网络；全部运行为进程内 vitest/tsc。

## 3. Changed Data Flow Verification

（设计 §8.3 R1/R2/R4 声明改变的路线；「Observed hops」均为运行时证据，非静态推断。）

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| R1 无预算成功读 | 值读两参 → `projectReadDataSchema` 两参 → 头行（无预算段）+ 渲染器正文；恒四键；`truncated:false` | 契约 A1/A3/B2/C1 + SA7 探针 P1（独立 fixture） | 键集 `[ok,schema,truncated,value]`；`'truncations' in r === false`；JSON 无该词；schema 逐字节 `=== '# readData []\n\n'+render(resolve(独立编译 derived,[]))`；无 ✂/‡ | 四键 + 文本 + 零截断 | 全部一致（探针 P1 逐字节通过） | pass |
| R2 预算成功读 | lifecycle gate → 三参值读 → canonical 净化 → 四参投影（canonical.options + 值通道 truncations）→ 头行预算段 + 正文 + ✂ | 契约 B1/B3 双夹具矩阵（10+14 路径 × 9 预算 = 216 格）+ 探针 P2/P3/P4 | canonical 预算反映进头行（`# readData [] {depth:1}` 等三形 + 键序 depth→maxChildrenPerNode）；✂ 段条目与值通道清单同源同序（`profile · depth · 省略 2 项` 等）；`truncated` 逐字段透传 | 216 格逐字节 `===` 独立 oracle | 全绿；探针（不同键域 fixture）同样逐字节通过 | pass |
| 组装序（头行 → 正文 → ✂） | 头行前贴 + `'\n\n'` + renderer 输出（renderer 冻结、不产出头行） | B1 逐字节锚 + C1–C7 + 探针 P1/P2/P5 | 头行块恒无换行（P5：on-schema Record 键 `a\nb` 折叠为 `extra.a b`）；空路径 `# readData []`（W1 口径）；首个 `\n\n` 恰为头/正文边界 | 附录 A 冻结格式 | 逐项一致 | pass |
| 截断信号单一载体 | `truncations` 键退役；✂ 段唯一载体；`truncated` 机器信号（⟺ ✂ 在场） | D1–D7 + 探针 P2/P3/Q5 | depth 截断：`truncated=true` + ✂ + `‡` + 页脚三信号齐；width-only：`truncated=true` + ✂ + 正文无 `‡` + 正文与无预算读逐字节同（全文因头行+✂ 不等）；`schema:null`×预算截断：null 与 `truncated=true` 诚实共存；无截断：三信号全无 | CT-4 全组 | 全部一致 | pass |
| 投影 detach 退役 | clone 家族删除；渲染器进程内直读；文本天然 detached | G1/G2 + 探针 T1/T2 + M8 突变敏感性 | `typeof schema === 'string'`；结果图无 `"valueSchema"`/`"aliasDocs"`；连续/交错读逐字节相等；改写 `r.value` 后文本不变；`replaceSchema` 后文本随新 derived（含新注释、头行不变） | 文本隔离由形态保证 | 全部一致 | pass |
| 结果类型坍缩 | 单一 `ReadDataOkResult` 四键形；两联合名/零泄漏注释/重载序保留 | test-d H1–H6（--typecheck 绿）+ 源码事实 | 两联合共用同一成功成员；legacy 联合注释「**不含** READ_OPTIONS_INVALID（零泄漏）」原文在场；`READ_OPTIONS_INVALID` 仅属预算联合；重载序 legacy 最后 | CT-8 解释（SA8 必行动作 2） | 一致（未合并联合） | pass |
| U3 公共转出退役 | `ReadLogicalValueTruncationEntry` 不再从 runtime 转出 | SA7 负向类型探针（临时 `.test-d.ts`） | `import type { ReadLogicalValueTruncationEntry } from '@nomicore/namespace-runtime'` → **TS2305** `has no exported member`；index.ts 仅注释提及 | 编译期闭锁 | 击穿成立 | pass |
| R4 lease 透传 | released 短路先于一切；active 期 raw options 同一引用直传；lease ≡ runtime 逐字段 | 契约 A′1–A′4、B′1/B′2 + 探针 L1（真实 Registry 装配） | lease 读四键 + 文本头行 + 截断信号与 runtime 直调 `toStrictEqual`；raw options 引用同一（含敌意 Proxy get trap 零触达、单参走 legacy 通道 argc=1）；released → `NAMESPACE_LEASE_RELEASED` 恰 `{ok,code,message}`、同参单例、零 runtime 触达、二次 release 幂等 | A5/A6/F4 | 全部一致 | pass |

## 4. Preserved Data Flow Verification

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
| --- | --- | --- | --- | --- | --- |
| 值通道（doc-runtime 冻结） | 无预算结果恰 `{ok,value}`；预算折叠/省略/omitted=直接子项数/零物化哨兵语义不变 | 探针 P1（键集恰两键）+ D7（oracle 直调对照）+ control 套件 | SA6 基线（#336 时代同语义） | 逐项一致；`truncations` 仅存于值通道载体与渲染器入参（正确去向） | pass |
| 失败分支 | `PATH_NOT_ALLOWED`/`READ_OPTIONS_INVALID`/`RUNTIME_READ_DISABLED` 恰 `{ok,code,path,message}`；定序 path→options、lifecycle 先于一切 options 触达 | A4/E3/E4 + 探针 Q3（含敌意 descriptor trap 计数=0） | ADR-0016/#92 既有形状 | 逐字节同形；失败分支无 schema/truncated/truncations | pass |
| released lease | 冻结 issue 短路先于透传；幂等 | B′1 + 探针 L1 | #273 起既有 | 同参同引用单例；recording runtime 零调用 | pass |
| options 闭合形状 | 非法矩阵响亮拒绝、差分 ≡ doc-runtime 权威、canonical 等价全文逐字节 | F1/F2/F3 + 探针 Q4（含 `Object.prototype` 污染 try/finally） | ADR-0024 冻结 | 13 类非法 → `READ_OPTIONS_INVALID`；`{}`/`{depth:undefined}`/非 enumerable/继承污染 → 与无 options 读逐字节同（头行无预算段） | pass |
| T1 渲染器冻结 | 144 tests 零改动 | 本轮两次聚焦运行均含 `render-projection-text.test.ts` | SA6 基线 144 绿 | 两次均 144 绿 | pass |
| 敌意 path 收敛 | 敌意迭代器/trap 零调用；null 单义绝不外抛 | E1/E2 + 既有 hostile-path-guard（4 tests）+ 探针 Q1（迭代器调用=0、Symbol.iterator 读>0） | #273 F-1 纪律 | 一致；M7 突变证明哨兵在位（见 §6） | pass |
| 原型污染用例隔离（SA4 §11 项 3） | 污染 try/finally 同步完成、不外溢 | vitest 配置事实 + 全量绿 | — | 默认 forks pool + `isolate` + `maxWorkers:1`（文件级隔离）；C5/F3/探针 Q4 两轮全绿 | pass（事实闭合） |

## 5. State Machine Verification

readData 无自有状态机（同步纯观察）；验证的是它依赖的生命周期/状态判定：

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
| --- | --- | --- | --- | --- | --- |
| preparing（P0 未结算） | `readData(path[,options])` | ok:true + `schema:null` + value 照常 | 探针 Q2 / E1①（value=2 读到） | 无 active schema 时触碰敌意对象（状态守卫先于 path 守卫——E1 敌意零调用计数佐证） | pass |
| ready | 正常读 / `replaceSchema` | 四键文本；schema 写槽完成后新 derived 即时可见 | B4 + 探针 T2（文本换新、头行不变） | 无缓存/陈旧文本（同参连读逐字节相等） | pass |
| ready → closing/closed | `close()` 后读 | `RUNTIME_READ_DISABLED` 恰四键失败形，先于 options 读取 | E3（敌意 descriptor trap=0）+ 探针 Q3 | closed 期任何 options 触达/doc 触碰 | pass |
| lease active → released | `release()` 后读 | `NAMESPACE_LEASE_RELEASED` 恰三键、同参单例、零透传；二次 release 幂等 | B′1 + 探针 L1 | released 后仍透传 runtime | pass |
| 结果形态 | 任意成功读 | 恒四键、schema string\|null、无部分输出 | A1–A3 + M2/M5/M8 突变期即红 | 部分输出/双形态/空串替 null（C7/Q5 显式断言非空串） | pass |

## 6. Error and Cleanup Flow（含 §12.11 突变全表）

**错误传播**：值失败短路先于一切投影工作（失败对象不带成功键，A4）；`InternalError` 唯一逃逸通道保持——E5 注入畸形 derived → readData throw 构造名 `InternalError`（本轮聚焦运行绿）；敌意 path/options/P0 未就绪零外抛（E6 + 探针 Q1/Q3）。非法 options 响亮 `READ_OPTIONS_INVALID`、绝不静默 `schema:null`（F1）。无静默 fallback、无吞错。

**突变敏感性 M1–M8**（SA6 §12.11 指定 SA7 执行；每突变 = 临时改实现 → 跑三文件 tripwire（runtime-red 32 + registry-red 6 + hostile-guard 4）→ 反向还原 → sha256 比对基准）：

| # | 突变（实现点） | Tripwire 观测（failed/passed） | 击穿断言（对照 SA6 预期） | 还原证明 |
| --- | --- | --- | --- | --- |
| M1 | `runtime.ts` 预算成功分支复挂 `truncations: result.truncations` 键 | 3 / 39 | A2、B1 严格矩阵、A′2 —— 预期 CT-1 A1/A2、H1/H3 ✓（A2 命中；A1 不受本分支影响，键删敏感性另由 M3 锁） | sha256 = 基准 OK |
| M2 | `assembleProjectionText` 返回 resolver JSON 对象而非文本 | 21 / 21 | B1–B5、C1–C6、D1/D3/D4、F3、G1、G2、A′1–A′3、既有 hostile-guard 合法路径 —— 预期 A1（键集不变类型红）+B1+G1 ✓ | sha256 OK |
| M3 | legacy 成功分支删 `truncated: false` 键 | 10 / 32 | A1、A3、B1×2、D1/D5、A′1、hostile-guard×4 —— 预期 A1/A3 ✓ | sha256 OK |
| M4 | 不贴头行（仅返回渲染器正文） | 15 / 27 | B1–B5、C1–C6、D4、A′1–A′3、hostile-guard —— 预期 B1、C1–C5 ✓ | sha256 OK |
| M5 | 截断清单不喂渲染器（✂ 段缺席） | 7 / 35 | B1 严格/raw、B5、D3、D4、A′2、A′3 —— 预期 D2/D3/D5 ✓ | sha256 OK |
| M6 | 头行段首大写（`meta`→`Meta`，模拟打印别名名） | 10 / 32 | B1×3、C2、**C3**、C6、D4、A′1、A′3、hostile-guard —— 预期 C3 ✓（空路径无段故 C1 不受影响，自洽） | sha256 OK |
| M7 | 删除敌意收敛守卫（迭代器同一性比较） | 4 / 38 | E1、E2、hostile-guard×2 —— 预期 E1/E2 ✓ | sha256 OK |
| M8 | detach「复活」：schema 包裹 `{text, valueSchema}` 额外对象 | 16 / 26 | B×3、C4/C5/C7、D×4、E1、F3、**G1**、G2、A′2、A′3 —— 预期 G1 ✓ | sha256 OK |

全部 8 项突变均击穿对应 CT 断言组（无盲区）；还原后五生产文件 `sha256sum -c` 全 OK（§8 命令 12）。SA3 报告 Deferred 的 M2–M8 由此闭合；SA3 自跑的 M1 sanity（A2+B1/B3）与本轮 M1 独立复现一致。

**清理时序**：突变逐个即时还原（无并发测试窗口：每突变后才开始下一突变，tripwire 运行均在该突变在场时完成）；探针删除后全仓 `tsc -p tsconfig.typecheck.json` exit 0（证明删除前该配置下仅我的临时件报错、删除后零残留）。

## 7. Temporary Diagnostics

| 件 | 性质 | 生命周期 |
| --- | --- | --- |
| `packages/namespace-runtime/test/zz-sa7-364-probe.test.ts`（13 tests，自造 fixture `ENV_SA7` + 独立 oracle） | 最小动态测试（skill 允许面：观察数据流所必需） | 新建 → 首轮 2 failed（**探针自身装置错误**：① 自造 fixture 有第三个可折叠容器 `extra`，值通道清单为 3 条非 2 条；② T2 误选 `['profile']` 路径观测 ROOT 字段注释变更——该路径渲染 Profile 类型体，换 `[]` 后成立）→ 修正后 13/13 绿 → **已删除** |
| `packages/namespace-runtime/test/zz-sa7-364-retired-import.test-d.ts` | 负向类型探针（U3 退役证明） | 新建 → TS2305 击穿取证 → **已删除** |
| `packages/namespace-runtime/zz-sa7-364-sample.mts`（+ /tmp 副本） | 一次性样张渲染脚本（非测试入口，vitest 不收集） | 运行取证 → **已删除** |
| `[SA7-DATAFLOW]` 临时日志 | — | **零添加**（既有契约测试 + 探针的返回值/键集/逐字节对照已足够观察全部关键跳点） |

**收尾核验**（全过）：

1. `grep -rn "SA7-DATAFLOW" packages apps domains docs .agents` → 0；
2. `grep -rn "zz-sa7" packages apps domains` → 0；
3. `git status --porcelain` = 28 M + 原有 untracked（与本验证开始时一致；新增仅本报告）；
4. 五生产文件 sha256 = 会话开始快照（见 §6 还原列与 §8 命令 12）；
5. 删除探针后关键场景复跑：聚焦家族 22 files / 346 tests / Type Errors: no errors / exit 0（与删除前逐项相同）；`tsc -p tsconfig.typecheck.json` exit 0；root `pnpm typecheck` exit 0。

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SA6 CT-1/AC1 | 恒四键、truncations 退役（负控） | 聚焦家族 + 探针 P1 + M1/M3 | 四键、`in` 检查、JSON 词汇 | 一致 | §3 R1/R2、§6 M1/M3 | pass | — |
| SA6 CT-2/AC2 | schema ≡ 头行 + 渲染器正文（oracle 逐字节、独立构造） | B1/B3 216 格 + 探针 P1/P2/P4/P5（不同 fixture） | 逐字节 `===` | 全过 | §3、§9 命令 2/4 | pass | — |
| SA6 CT-3/AC3 | 头行事实性（path/预算/省略/行注入） | C1–C7 + 探针 P4/P5/Q4 | 附录 A 冻结格式 | 一致 | §3 | pass | — |
| SA6 CT-4/AC4 | 截断信号一致性（✂ 唯一载体、width 对偶、D6 诚实形态） | D1–D7 + 探针 P2/P3/Q5 + M5 | 三信号矩阵 | 一致 | §3、§6 M5 | pass | — |
| SA6 CT-5/AC5 | null 三情形单义、失败/生命周期不变 | E1–E6 + hostile-guard + 探针 Q1–Q3/Q5 + M7 | 严格 null、零调用、定序 | 一致 | §4/§5/§6 | pass | — |
| SA6 CT-6/AC6 | options 闭合形状零变化（校验/透传/canonical） | F1–F3 + B′2 + 探针 Q4/L1 | 拒绝码、引用直传、逐字节等价 | 一致 | §4 | pass | — |
| SA6 CT-7/AC7 | detach 退役 + 文本隔离 | G1/G2 + 探针 T1/T2 + M2/M8 | string 形态、零交叉污染、无陈旧缓存 | 一致 | §3、§6 | pass | — |
| SA6 CT-8 | 类型面锁（四键同型、零泄漏、U3 退役） | 7 个 test-d（--typecheck 绿）+ 负向类型探针 | H1–H6 + TS2305 | 全过 | §3、§7 | pass | — |
| SA6 CT-9/AC8 | 消费面翻新（编译门/收敛门/零遗留） | 聚焦家族 346 tests + 收敛门 24 tests + tsc exit 0 | 全绿、family A/B 归零 | 全过 | §9 命令 1/3/10 | pass | — |
| SA6 CT-10/AC9 | 文档词汇门（双向敏感） | sync-control 35 + sync-red 8 + fixture 自控 | 新词在场、旧词清退 | 全绿（两轮） | §9 命令 1/9 | pass | — |
| SA6 §12.11 | M1–M8 突变敏感性全表 | 本轮逐突变执行 | 每突变击穿对应 CT | 8/8 击穿 + 还原 | §6 | pass | — |
| SA4 §11-1 | M2–M8 未逐条执行（SA3 deferred） | 同上 | 闭合 | 闭合 | §6 | pass | — |
| SA4 §11-2 | released lease 完整生命周期 | B′1 + 探针 L1（真实装配 + 幂等） | 短路/单例/幂等 | 一致 | §5 | pass | — |
| SA4 §11-3 | 原型污染用例的 runner 拓扑依赖 | vitest 配置事实 + 两轮全绿 | 文件级隔离成立 | forks+isolate+maxWorkers:1 | §4 末行 | pass | 若未来改同进程串行需迁移该用例（登记即可） |
| SA6 U1/W1 | 空路径头行口径 `# readData []` | C1 + 探针 P1/P5 | 操作性口径 | 一致 | §3 | pass | — |
| Design §8.3 | 数据流四路线 + 边界形态 | 上述全部 | 跨四跳形态正确 | 一致 | §3/§4 | pass | — |

额外发现（不扩大验证范围，仅登记）：无。探针首轮 2 例失败均为探针装置错误（§7 已记录），非实现缺陷。

## 9. Commands and Evidence

| # | Command | Result |
| --- | --- | --- |
| 1 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run --typecheck <SA3 聚焦家族 22 文件>`（进入验证首轮） | **22 files / 346 tests passed，Type Errors: no errors，exit 0**（5.28s） |
| 2 | 同上（探针删除后复跑） | **22 files / 346 tests passed，Type Errors: no errors，exit 0**（7.41s）——删除前后逐项相同 |
| 3 | `npx tsc --noEmit -p tsconfig.typecheck.json`（探针在场） | exit 2，错误**全部**位于 `zz-sa7-364-probe.test.ts`（探针自身类型松弛，行为面已被 vitest 执行验证）+ `zz-sa7-364-retired-import.test-d.ts` 的**预期** TS2305 |
| 4 | `NODE_OPTIONS=--conditions=nomicore-source npx vitest run packages/namespace-runtime/test/zz-sa7-364-probe.test.ts` | 首轮 11/13（2 例探针装置错误）→ 修正后 **13/13 passed，exit 0** |
| 5 | `npx tsx packages/namespace-runtime/zz-sa7-364-sample.mts`（样张取证） | 输出见下文样张；与探针 P2 的逐字节锚互证 |
| 6 | M1–M8 各：edit 生产文件 → `npx vitest run <runtime-red + registry-red + hostile-path-guard>`（无 --typecheck，运行时行为为 tripwire） | 每 mutation exit 1，failed/passed 与击穿断言见 §6 表 |
| 7 | 每突变后 `sha256sum -c <会话开始快照>`（对应文件） | 全部 OK（M1/M3/M8 → runtime.ts；M2/M4/M5/M6/M7 → read-schema-projection.ts） |
| 8 | `sha256sum -c /tmp/sa7-364-prod-hashes-before.txt`（五文件终检） | **全 OK** |
| 9 | `grep -rn "SA7-DATAFLOW" …` / `grep -rn "zz-sa7" …` | 0 / 0 |
| 10 | `pnpm typecheck`（root，14 tsconfig 串行） | **exit 0** |
| 11 | `git status --porcelain` | 28 M + 原有 untracked，与本验证开始时一致（新增仅本报告） |
| 12 | 负向类型探针 `zz-sa7-364-retired-import.test-d.ts` | `error TS2305: Module '"@nomicore/namespace-runtime"' has no exported member 'ReadLogicalValueTruncationEntry'` |

**SA7 观测样张**（自造 fixture `[] + {depth:1}`；探针 P2 已证 `r.schema` 与该 oracle 产物逐字节相等）：

```text
# readData [] {depth:1}

{
  code: string // project code
  weight: number // weight
  profile: Profile‡ // owner profile
  milestones: [...]‡ // milestones
  extra: [...]‡ // misc extras
  note?: string // optional note
}

‡ 截断标记：该类型位因读取预算（depth 耗尽）折叠；对该路径再读可展开。

✂ 截断事实：
- profile · depth · 省略 2 项
- milestones · depth · 省略 4 项
- extra · depth · 省略 1 项
```

值通道对偶：`truncated=true`，`truncations=[{path:['profile'],kind:'depth',omitted:2},{path:['milestones'],…,omitted:4},{path:['extra'],…,omitted:1}]`。

**门禁证据归属**：root `pnpm test`（386 files / 4607 tests / Type Errors: no errors / exit 0）由 SA3 iteration 1 clean 轮记录（`wiki/raw/task_issue-364_sa3_iter1b_root_test_clean.log`）；SA7 按 skill 边界不重跑全仓回归，本轮以 root `pnpm typecheck` exit 0 + 聚焦家族两轮全绿 + 突变/还原链自证。

## 10. Deviations

1. **M1/M3 各只作用于单分支**（预算 / legacy）：突变最小化以便归因；SA6 预期断言组内相应命中（M1→A2、M3→A1/A3），另一分支的键敏感性由对方突变互补覆盖（M1+M3 合计覆盖两分支键集）。
2. **M6 以段首大写模拟「打印别名名」**（组合层无别名查找可劫持；`meta`→`Meta` 恰为 C3 点名的失败形态）；被锁的契约面（实参 path 逐字节）不变。
3. **M8 以结果位包裹对象模拟「detach 复活 + 额外返回对象」**（clone 家族已物理删除，字节级复活不可达）；G1 的 typeof/JSON 双探针即为该风险的行为锚，均击穿。
4. **探针首轮 2 例失败为探针装置错误**（fixture 折叠容器计数、replaceSchema 观测路径选择），修正探针后全绿；实现零改动（§7 已记录全过程）。
5. **探针测试文件类型松弛**（本地 `Budget` 接口 vs doc-runtime options 类型的窄化）：行为证据以 vitest 运行时执行为准；文件已删除，删除后全仓 tsc exit 0 证明零残留。
6. **root `pnpm test` 未由 SA7 重跑**（skill 禁全仓回归）；引用 SA3 clean 轮日志为门禁证据，SA7 补跑 root typecheck。

## 11. Verdict

**approve**。

- 设计声明改变的全部数据流（R1/R2/R4 + 组装序 + 截断载体 + detach 退役 + 类型坍缩 + U3 转出退役）经运行时证据确认按设计变化，关键跳点（canonical 预算进头行、值通道清单喂 ✂、lease 引用直传、released 短路）均有直接观测；
- 设计声明不变的路线（值通道、失败分支、生命周期、options 闭合形状、渲染器冻结、敌意收敛）逐项保持；
- 状态/生命周期判定与关键值正确，禁止状态（部分输出、双形态、空串替 null、released 透传、closed 触碰 options）未出现；
- 错误分类与清理符合设计；M1–M8 突变全表击穿且 sha256 还原闭环；SA3 deferred 的 M2–M8 与 SA4 §11 动态项 1/2/3 全部闭合；
- 临时诊断已清理，删除后关键场景结果不变，工作树与本验证开始时逐字节一致（五生产文件 sha256 终检全 OK）。

无阻断项、无独立 fail、无需冲突复查的新事实（`requiresConflictRecheck` 不变更为是——设计期已定 `true` 并由 SA8 实现后复查 clear 闭合；本轮未发现新的 ADR 冲突面）。
