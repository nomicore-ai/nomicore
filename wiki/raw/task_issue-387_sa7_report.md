# SA7 动态验证报告 — issue #387：watchMap 无谓词形态垂直通路（变更订阅 T1 / tracer bullet）

- 轮次：final-verification（iteration 0）；前置 = SA4 实现静态审查 **approve**（0 × BLOCKER /
  0 × MAJOR）+ SA8 实现后冲突门 clear（`requiresConflictRecheck=false`）。
- Worktree：`/home/wangjian/nomicore-fix-issue-387`（branch `mabf/issue-387`，HEAD `6df1c61`，
  实现未提交 = SA4 已审工作树：19 处已跟踪修改 + 4 个新源/契约文件——本轮动态验证前后
  `git status` 逐字一致，零实现改动）。
- 结论：**approve** —— 设计声明改变的全部数据流按设计变化；声明保持的路线全部保持不变；
  状态机转换与关键值正确、禁止状态未出现；错误传播与 cleanup 到达 quiescence；临时诊断已清理。

---

## 1. Inputs

| 输入 | 状态 | 用途 |
|---|---|---|
| `wiki/raw/task_issue-387.md`（brief） | 在场 | What-to-build 演示场景 + AC1–AC10；评论 0 条（REST `[]`，dispatch 复确认） |
| `wiki/raw/task_issue-387_design.md`（SA1 iteration 2） | 在场 | §8-A–G 数据流/状态机规格、§7 D1–D10 冻结、§11 ALLOW/DENY、§12 验收映射 |
| `wiki/raw/task_issue-387_sa6_contract.md` | 在场 | 契约三件套（设计动态驱动主接缝）+ 非目标边界 |
| `wiki/raw/task_issue-387_sa3_impl.md` | 在场 | Changed paths / V1–V7 门禁证据索引 |
| `wiki/raw/task_issue-387_sa4_review.md`（**approve**） | 在场 | §11 后续动态验证项（本轮覆盖清单来源）+ §12 N-1–N-5 缺口 |
| `wiki/raw/task_issue-387_implementation_conflict_report.md`（SA8 clear） | 只读 | 协议边界识别（不可改变面） |
| `docs/adr/0030-change-subscription.md` | 只读 | §3/§4/§5/§6 规范权威（通知形状 / 宁多勿漏 / 分发纪律） |
| 被验实现（工作树实读） | 在场 | `watch-map.ts`（488 行）/ `runtime.ts` / `errors.ts` / `lease.ts` / 两 `index.ts` / `types.ts` / `ws-replication/src/testing.ts` |

Owner 要求：无（评论 0 条）→ 无 owner 条款需映射。

## 2. Runtime environment

| 项 | 值 |
|---|---|
| 环境 | Linux；node `v24.13.0`；pnpm `10.28.2`；vitest `3.2.7`；typescript `5.9.3` |
| 依赖 | 仓内 `node_modules` 就绪（零安装；探针/测试直跑；`NODE_OPTIONS=--conditions=nomicore-source` 仓内既有约定） |
| 被验状态 | SA4 已审未提交实现（上表）；验证全程零生产代码改动、零 DENY 路径触碰 |
| 服务/进程 | 纯进程内 vitest 运行，无服务启动、无后台 job、无端口占用（收尾核对：`job` 列表空） |

## 3. Changed Data Flow Verification

| Route | Design change | Runtime driver | Observed hops | Expected result | Actual result | Verdict |
|---|---|---|---|---|---|---|
| lease → runtime → hub 建立通路（§8-F/§8-G） | lease 第 16 键 `watchMap` 透传 runtime 第 15 键 → `createWatchHub`；返回恰 `{unsubscribe}` | 探针 A1（真实 Registry 装配） | lease 恰 16 键 / runtime 恰 15 键（排序清单逐字）；句柄键恰 `['unsubscribe']` | 纯加法公共面 + handle 单键 | 与预期逐字一致 | pass |
| 演示场景垂直通路（issue What-to-build） | open → `watchMap(['tasks'])` → 一事务两 set → 恰一条 `{kind:'data',origin:'local',changes:[{path,key}×2]}` → `readData([...path,key])` 补拉 | 探针 A1 + 契约 N1/N2 | 通知 JSON 逐字 = `{"kind":"data","origin":"local","changes":[{"path":["tasks"],"key":"t3"},{"path":["tasks"],"key":"t4"}]}`；两定位符 `readData` 补拉值与写入 `toStrictEqual`；通知/changes/定位符/path 四层 `Object.isFrozen` 全 true；payload 哨兵不外泄 | 一事务一通知、定位符可拼路径、信号不含值、深冻结纯数据 | 全部命中 | pass |
| 槽外异步分发（§8-E；AC6/D1/D2） | listener 调用移出事务栈与写序列器槽 | 探针 A1（mutate 调用栈内标志位）+ 契约 D1/D2 | `mutateData` 调用栈期间 listener 零回调；后续写即时 ok；契约 D2 回调内重入写被接纳并完成 | 同步段零回调、不阻塞后续写 | 全部命中（探针标志位 false + 契约绿） | pass |
| 建立状态机六门拒绝位（§8-B） | ②TypeError；③`WATCH_MAP_SCHEMA_UNAVAILABLE`；④⑤`WATCH_MAP_CARRIER_MISMATCH` 四路异 message | 探针 B1/B2/B3 + 契约 E4/E5 | 逐码逐 message 实测：非函数 listener → `TypeError`；legacy 无 schema → `WATCH_MAP_SCHEMA_UNAVAILABLE`；数组载体/根标量/偏离 schema/敌意 path（Proxy 摘除 iterator）→ 同码四异 message（日志 `[SA7-EVIDENCE] B2` 四行逐字） | 响亮同步 throw + 稳定码 + message 区分原因 | 全部命中 | pass |
| ③b ROOT 载体门（D10） | 异型 ROOT 构造容错（零抛零副作用）+ 建立场响亮拒绝（复用 CARRIER_MISMATCH 码 + ROOT 专属 message） | 探针 F1（Y.Text-ROOT 文档经真实 Registry open）+ P0 契约 7/7 | 构造照常 ready、schema ready；`watchMap(['tasks'])` → `WATCH_MAP_CARRIER_MISMATCH` + message 含「ROOT 载体非键容器」；构造后 `doc.getText('ROOT').toString()` 仍为原值（载体零副作用） | fail loud、不静默建立死订阅、P0 AC5 不破 | 全部命中 | pass |
| 事务级信号推导（§8-C C-1/C-2；AC5） | 一事务一通知、同 key 首见序合并、嵌套归条目 key、FIFO | 契约 N1/N3/B1/B2 | 批量两键 → 1 通知 2 定位符；兄弟路径同事务 → 1 定位符；两事务 → 2 通知 FIFO（提交序） | 聚合去重与事务原子可见 | 全绿（契约套件） | pass |
| origin 无过滤分类（D8；ADR §4/§6） | null → 'local'；symbol（复制 apply）→ 'replication'；不过滤任何来源 | 探针 E1（真实 `enableReplication` + `openReplicationSession` + peer 副本 raw update + `applyRemoteUpdate`） | 同一订阅先本地写后复制 apply → 两通知 origins 逐字 `["local","replication"]`，定位符 `l1`/`r1` 各自正确；`readData(['tasks','r1'])` 补拉 replication 来源写入成功 | 复制 apply 事务结构性直达观察器（T1 交付态机制） | 命中（SA4 §11 动态项「'replication' 分类真实触发」闭合） | pass |
| 真变判定（§8-D；ADR §5） | add/delete 恒真变；update 双侧 plain → 深比较相等过滤；任一侧 live 载体 → 保守通知；无效写零事务零通知 | 探针 B4/B5/E2 + 契约 P2 | 标量同值写 → 零通知（过滤）；受控整替（plain 旧值 → schema 物化 live Y 载体新值）→ 保守通知 `{path:[],key}`；复制来源 plain 同值整替（双侧 plain）→ `plainDataEquals` 过滤零通知、真变整替 → replication 通知；无效写 → 零通知 | 宁多勿漏方向（可判面精确、不可判面保守） | 全部命中（`plainDataEquals` 双向经 E2 动态证实） | pass |
| 有界队列溢出降级（§8-E；ADR §6） | 容量 16：清空在队 data → 单条 `invalidate-all`（origin=触发事务分类）；订阅存活、后续 data 恢复 | 探针 G1（40 连发不 await 事务，×3 复跑） | 三次运行同值：`received=8 (data=6, invalidate-all=2)`，kindSequence 逐字 `["data","data","data","invalidate-all","data","data","data","invalidate-all"]`，origins 全 'local' | 溢出 → 清队 + 单条降级信号；每次丢弃都被其后 invalidate-all 覆盖（末信号=全量重拉指示） | 命中且稳定（SA4 §11 动态项「溢出降级真实触发」闭合；T4 #390 注入与验收仍属其票） | pass |
| C-3 容器级事件（§8-C） | 容器创建/删除/整替 → T1 不产出条目定位符 | 探针 C1（seed 物化 + delete + 整容器重建 + 条目写） | delete → 微任务栅栏后零通知；整容器重建 → 零通知；重建后条目写 → `{path:['optionalTasks'],key:'t10'}` 到达（订阅横跨删除期存活） | T1 边界零条目定位符 + 重建后条目照常到达（ADR §4） | 全部命中 | pass |
| O-3 空路径边界（§7-D3） | map 形 ROOT 下 `watchMap([])` 合法；C-1 产出 `{path:[],key}` | 探针 B4 | `watchMap([])` 建立成功；根级整替通知 `changes=[{path:[],key:'tasks'}]`；`readData(['tasks'])` 可读 | 显式承认的合法边界 | 命中 | pass |
| R9 schema 替换静默窗（§13-R9） | 订阅跨 `replaceSchema`（无 root）存续且无信号（watch-end 属 T3 #389） | 探针 H1 | 无 root `replaceSchema` 成功 + schema 回 ready → 栅栏后零通知；随后条目写 → 1 通知 `{path:['tasks'],key:'t3'}` | T1 交付态静默窗 + 订阅存活 | 命中 | pass |
| lease 释放清理（§8-F；AC8/L2） | release 首调同步段遍历退订全部该 lease 订阅 + 摘登记 | 探针 D1/D2 + 契约 L2 | released lease `watchMap` → `NamespaceLeaseReleasedError`（code `NAMESPACE_LEASE_RELEASED`，SA4 N-1 缺口闭合）；释放后第二 lease 写 → 旧订阅零到达；释放后句柄退订双次零 throw（双幂等包装） | 零悬空回调、released 通道先于透传 | 全部命中 | pass |
| runtime close 收口（§8-G） | `closeAfterFence` 同步段 `watchHub.shutdown()`：摘 observer、清全部订阅与队列（静默） | 探针 D3（写已提交、通知在队时同步 close） | `deliveredBeforeClose=0 → afterShutdown=0`（在队通知被清、零投递）；close 后 `runtime.watchMap` → `RuntimeReadDisabledError`（code `RUNTIME_READ_DISABLED`，message 含 `watchMap`）；close 后写 → `RUNTIME_WRITE_DISABLED`（零事务零复活） | 关停后零新投递、建立面停接纳、不复活 | 全部命中 | pass |
| 退订幂等与重建（§8-E；AC8/L1） | `unsubscribe` 幂等零通知；退订后可重新建立 | 契约 L1 + 探针 D4 | 双次退订零 throw；退订后写零到达；同路径重建订阅 → 新通知恢复（旧 sink 不再收到） | 状态机可重入 | 全部命中 | pass |

## 4. Preserved Data Flow Verification

| Route | Preserved invariant | Runtime driver | Baseline observation | Current observation | Verdict |
|---|---|---|---|---|---|
| readData 成功面 | 恰四键 `{ok,value,schema,truncated}`、schema 为投影文本 | 契约 NC1（`expectReadDataOkKeys` 集中化 helper） | SA6 基线绿（HEAD 实现前） | 本轮契约套件内 NC1 绿（`-contract-suite.log` / `-post-removal-contract.log` 21/21 内） | pass |
| 窗口读冻结面（#369） | lease 窗口读契约零回归 | `issue-369-window-read-lease-contract-red.test.ts`（33 用例；其 `makeStubRuntime` 为结构实现点⑨，本票仅补 throw stub、断言 diff=0） | SA6/SA3 基线 33/33 | 33/33 绿（两轮运行同值） | pass |
| readData 形状守卫门（#333/#336/#364） | 形状断言集中化纪律 | `readdata-shape-assertion-consolidation-gate.test.ts` | 24/24（SA6 修复后） | 24/24 绿（`-preserved-faces.log`） | pass |
| lease readData 透传面 | budget/options 原样直传、投影文本面 | `registry-readdata-budget-passthrough`（5）/ `registry-readdata-projection-text-red`（6）（两文件为本票字面量桩⑥⑦所在，仅补一行 throw stub） | 既有绿 | 5/5 + 6/6 绿 | pass |
| runtime 值导出面 | exports 审计不变（type-only 追加零影响） | `runtime-acceptance-exports-audit`（4） | 既有绿 | 4/4 绿 | pass |
| 公共键集守卫四处 | lease 15→16 / runtime 14→15（纯加法 +1 行） | `registry-open`（32，lease 16 键）/ `runtime-registry-internal-seam`（5）/ `runtime-phase5-reset-fence-r2`（7）/ `runtime-close-lifecycle`（10，含负向事件订阅词审计原样） | 实现前红（15/14 键） | 全绿；探针 A1 的 `Object.keys` 排序清单同值复核 | pass |
| 写序列器 FIFO 与顺序 | 通知顺序 = 事务提交序；分发不占槽、不阻塞写 | 契约 B2/D2 | 设计基线 | 绿（两事务两通知 FIFO；重入写接纳完成） | pass |
| P0 构造独立性（ADR 0008） | 普通 open 不验证 ROOT 载体/logical（③b 分界锚） | `runtime-p0-sequencer.test.ts`（7） | 既有绿 | 7/7 绿 | pass |
| ws-replication API 类型面 | ⑩ 仅 testing surface 一行透传，导出面/wire 零改动 | `ws-replication-api.test-d.ts`（17）+ 根 typecheck（SA3 门禁③ exit 0） | 既有绿 | 17/17 绿 + Type Errors: no errors | pass |
| 复制 wire/协议/持久化 | 零 diff | `git status`（DENY 清单全量对账） | SA4 对账零命中 | 本轮验证前后零命中（19 处 tracked 修改清单逐字同 SA4 §6） | pass |

## 5. State Machine Verification

| Initial state | Trigger | Expected transitions | Observed transitions | Forbidden transitions absent | Verdict |
|---|---|---|---|---|---|
| 无订阅 | `watchMap(path, listener)`（合法键容器） | → subscribed（登记 + 返回幂等句柄） | 探针 A1/B4/H1、契约 E1–E3 | 失败半登记（校验全前置）未出现：全部拒绝位零订阅建立（契约 E 组 + 探针 B 组六拒绝位实测） | pass |
| 无订阅 | 六门任一拒绝（TypeError/无 schema/ROOT 异型/形状敌意/偏离/非键容器） | → 保持无订阅 + 同步 throw | 探针 B1/B2/B3/F1 逐码逐 message | 静默建立/信封面未出现 | pass |
| subscribed | 写事务提交 | queued → pumping → listener 收恰一条 data 通知 | 契约 N1/B1/B2 + 探针 A1 | 事务栈内/槽内回调未出现（探针标志位 false） | pass |
| subscribed | `unsubscribe()`（重复调用） | → unsubscribed；清队；零通知；可重新建立 | 契约 L1 + 探针 D4（重建后恢复通知） | 退订后投递未出现 | pass |
| subscribed | 队列溢出（>16 在队） | 清队 → 单条 invalidate-all → 订阅存活 → 后续 data 恢复 | 探针 G1（kindSequence 实测，×3 稳定） | 溢出丢订阅/队列未清未出现 | pass |
| subscribed（lease active） | `lease.release()` | → 订阅全部退订（同步段）→ released：`watchMap` throw `NamespaceLeaseReleasedError` | 探针 D1/D2 + 契约 L2（第二 lease 写零到达） | 释放后投递/静默建立未出现 | pass |
| subscribed（runtime ready） | `runtime.close()`（通知在队时） | → shutdown：摘 observer、清订阅与队列（静默零 watch-end）→ closed：`watchMap` throw `RuntimeReadDisabledError('watchMap')` | 探针 D3（0→0 投递；码+message 实测） | 关停后新投递/旧路径复活（写 RUNTIME_WRITE_DISABLED 零事务）未出现 | pass |
| schema preparing/无 | `watchMap` | → `WATCH_MAP_SCHEMA_UNAVAILABLE` 拒绝（③门 `!== 'ready'`） | 探针 B3（legacy）+ 契约 E4（同场阳性对照） | 无 schema 静默建立未出现 | pass |
| subscribed + schema 替换（无 root） | `replaceSchema` | 订阅存续、零信号（T1 静默窗）→ 后续写恢复通知 | 探针 H1 | 未经设计的 watch-end/丢订阅未出现 | pass |
| 并发触发 | 40 连发事务（不 await） | 每事务 ≤1 通知；丢失必被其后 invalidate-all 覆盖；末信号为全量重拉指示 | 探针 G1（data×3→inv→data×3→inv；distinctKeys=6 + 2 降级信号覆盖其余 34 笔） | 无覆盖的静默丢失未出现（丢弃只发生在溢出分支内、同分支立即入队 invalidate-all） | pass |

## 6. Error and Cleanup Flow

- **回调 throw 静默隔离（AC7/X1）**：坏消费者被调用（≥1 次）但写结果 ok、sequencer 后续写 ok、
  同场健康订阅照常收到（契约 X1 绿）；handler 整体吞没红线全程零 DOCRT-E203 观察（所有场景
  写面均正常提交；行为级故障注入属 T4 #390 已登记分期）。
- **无效写零通知（P2）**：schema 拒绝写零事务 → 零事件 → 零通知（契约绿；探针各零通知断言
  均以微任务栅栏证明而非 sleep）。
- **错误分类与面**：建立失败六稳定拒绝位 + `TypeError` + `NamespaceLeaseReleasedError` +
  `RuntimeReadDisabledError('watchMap')` 全部同步 throw、码字稳定、message 区分原因（探针
  `[SA7-EVIDENCE]` 行逐字留档）；失败路径零订阅登记、零 observer 变更。
- **cleanup 到 quiescence**：三条退订路径（主动 unsubscribe / lease release / runtime close）
  均到达零投递稳态（探针 D2/D3/D4 + 契约 L1/L2）；退订幂等双次零 throw；释放清理逐句柄
  try/catch 隔离；shutdown 幂等（`shutdownDone`）。
- **溢出恢复**：清队 + 单条 `invalidate-all` 后订阅存活、后续 data 恢复（探针 G1 实测流形状），
  消费面全量重拉自愈（ADR §6 语义）。
- **restart/复活**：close 后写被 `RUNTIME_WRITE_DISABLED` 拒绝（零事务 → 零通知复活）；
  release 后同 namespace 第二 lease 写不达旧订阅；退订后同路径重建需显式再建立（旧句柄
  不复活）——旧路径零复活。

## 7. Temporary Diagnostics

- **添加项**：临时 vitest 探针 `packages/namespace-registry/test/issue-387-sa7-dynamic-probe.test.ts`
  （16 场景 + `[SA7-EVIDENCE]` 观测行；覆盖 SA4 §11 全部动态项与契约未断言跳点）。**未在
  任何生产文件添加 `[SA7-DATAFLOW]` 日志**——既有测试 hook / 返回值 / 公共面可观察量足以
  观察全部关键跳点与状态转换，ALLOW LIST 日志协议未被触发。
- **删除项**：上述探针文件已删除（`ls packages/namespace-registry/test | grep issue-387`
  → 恰契约三件套；无 `.sa7-*` 残留目录）。
- **post-removal 验证**：契约套件复跑 63/63、exit 0（与删除前逐字同值：
  `artifacts/sa7-issue387-post-removal-contract.log`）；保真面套件复跑 110/110 +
  Type Errors: no errors、exit 0（`artifacts/sa7-issue387-preserved-faces.log`——首轮该
  组合 exit 1 系探针文件自身被 `tsconfig.typecheck.json` include 命中的 18 处
  noUncheckedIndexedAccess 类型错，非被验实现问题；删除后干净）。
- **git diff 核查**：全树 `grep SA7-DATAFLOW` 于本票改动文件零命中（仓内 80 处命中全部为
  其他票历史 wiki 报告文本，`git status` 改动清单内 0 处）；工作树回到 SA4 已审状态
  （19 tracked 修改 + 4 新文件 + wiki 输入，逐字一致）。

## 8. Dynamic Evidence Matrix

| Source | Requirement or risk | Driver | Expected | Actual | Evidence | Result | Suggested routing |
|---|---|---|---|---|---|---|---|
| SA4 §11-1 | 溢出降级真实触发（容量 16） | 探针 G1 | 清队 + 恰一条 invalidate-all + 订阅存活 + data 恢复 | data=6 / inv=2 / 序列 `d,d,d,inv,d,d,d,inv`，×3 稳定 | `-dynamic-probe.log` `[SA7-EVIDENCE] G1` | 覆盖 | T4 #390 补注入构造参数与验收断言（既有分期） |
| SA4 §11-2 | 'replication' 分类真实触发 | 探针 E1 | data 通知 origin='replication'，不被过滤 | origins `["local","replication"]` + 定位符 + 补拉回环 | `-dynamic-probe.log` `[SA7-EVIDENCE] E1` | 覆盖 | T3 #389 补契约断言编排 + watch-end（既有分期） |
| SA4 §11-3 | 观察器故障注入（R1 红线可测性） | —（T4 分期） | 写结果不变、无 DOCRT-E203 | 本轮全部场景零 fatal 观察（被动证据）；主动注入属 T4 工厂 | 各运行日志零 fatal | 部分（按分期） | T4 #390 交付 testing 工厂注入时补用例（O-5 登记，勿丢） |
| SA4 §11-4 | C-3 边界消费侧风险（容器删除零信号） | 探针 C1 | delete/整替零条目定位符；重建后条目写恢复 | 零通知（栅栏证明）+ `t10` 恢复到达 | `-dynamic-probe.log` | 覆盖 | T4 #390 父路径删除编排（invalidate-all 化） |
| SA4 §11-5 | schema 替换静默窗（R9） | 探针 H1 | 订阅存续零信号，后续写恢复 | 零通知 + `t3` 恢复到达 | `-dynamic-probe.log` | 覆盖 | T3 #389 watch-end 终止编排 |
| SA4 §11-6 | 泵公平性/事件循环占用 | 契约 D2 + 探针 G1 | 不阻塞写、无饥饿超时 | 全场景零超时、重入写完成、40 连发全部结算 | `-contract-suite.log` / `-dynamic-probe.log` | 覆盖（负载级） | — |
| SA4 §11-7 / N-1 | released 通道行为断言 | 探针 D1 | 同步 throw `NamespaceLeaseReleasedError` | name/code 实测命中 | `-dynamic-probe.log` | 覆盖 | 后续票触契约面时可补一行断言（SA4 N-1 建议） |
| SA4 §12-N-3 | ③b/敌意 path 两拒绝位行为 | 探针 F1/B2 | 码 + 专属 message | 逐字命中（ROOT 载体 / 形状敌意） | `-dynamic-probe.log` | 覆盖 | 设计 §12/R10 已声明非本票验收边界 |
| SA4 §12-N-4 | plain 容器通知面交互 | 探针 B4/E2 | 整替 = C-3/保守通知；plain 双侧深比较过滤 | 保守通知（受控写物化 live 载体）+ plainDataEquals 过滤（复制来源双侧 plain） | `-dynamic-probe.log` | 覆盖 | T4 #390 编排父路径删除信号时一并覆盖（SA4 建议） |
| Design §8-A | 通知深冻结/不含值 | 探针 A1 | 四层 isFrozen + 哨兵不外泄 | 全命中 | `-dynamic-probe.log` | 覆盖 | — |
| Design §7-D3/O-3 | 空路径合法边界 | 探针 B4 | `watchMap([])` 建立 + `{path:[],key}` | 命中 | `-dynamic-probe.log` | 覆盖 | — |
| SA6 契约 | AC1–AC10 主接缝行为 | 契约三件套 | 21/21 + 2/2 + 33/33 + 7/7 | 全绿两轮（删探针前后同值） | `-contract-suite.log` / `-post-removal-contract.log` | 覆盖 | — |
| Design §12 | 保真面零回归 | 保真面 9 文件 | 全绿 | 110/110 + no type errors | `-preserved-faces.log` | 覆盖 | — |

## 9. Commands and Evidence

| # | Command（worktree 根；均 `NODE_OPTIONS=--conditions=nomicore-source`） | 结果 | Evidence |
|---|---|---|---|
| C1 | `npx vitest run --typecheck <387 tracer-red + 387 lease-surface test-d + #369 negctl + P0 sequencer>` | 4 files / **63 tests passed**、Type Errors: no errors、exit 0 | `artifacts/sa7-issue387-contract-suite.log` |
| C2 | `npx vitest run --typecheck.enabled=false <387 sa7 dynamic probe>`（临时探针，运行后删除） | **16/16 passed**、exit 0；含 `[SA7-EVIDENCE]` 观测行（通知 JSON/错误码与 message/origin 序列/溢流 kindSequence/close 计数） | `artifacts/sa7-issue387-dynamic-probe.log` |
| C3 | 同 C2 连跑 3 次（G1/D3 稳定性） | 三轮 `[SA7-EVIDENCE]` 逐字同值（burst=40 → 8 收条 / d6+inv2；close 0→0） | 终端实录（C2 日志为其一并留档） |
| C4 | `npx vitest run --typecheck <readdata 守卫门 + budget-passthrough + projection-text-red + exports-audit + internal-seam + phase5 + close-lifecycle + registry-open + ws-replication-api test-d>`（探针删除后） | 9 files / **110 tests passed**、Type Errors: no errors、exit 0 | `artifacts/sa7-issue387-preserved-faces.log` |
| C5 | 删探针后复跑 C1 同命令 | 63/63、exit 0（与 C1 逐字同值——移除诊断后结果不变） | `artifacts/sa7-issue387-post-removal-contract.log` |
| C6 | `git status --short` + 全树 `grep SA7-DATAFLOW`（改动文件内） | 19 tracked + 4 新文件 + wiki 输入（与 SA4 §6 对账逐字一致）；改动文件内 marker 零命中 | 终端实录（§7） |

## 10. Deviations

- **实现偏差：无**。全部设计声明改变/保持的路线与冻结面均按设计观察。
- 探针侧三轮迭代修正（非实现问题，留档以防误读）：
  1. 受控整容器写在 schema 物化下新值为 live Y 载体（旧 plain + 新 live → 不可判 → 保守通知）
     ——探针初版误期「同值过滤」；实际行为 = 设计 D4 保守方向。双侧 plain 的深比较过滤改经
     复制来源 plain 写（E2）证实。
  2. 写路径导航不自动创建中间容器（`mutation-local.ts`「中间容器缺失——不自动创建中间容器」）
     ——C-3 探针改为「整容器重建 → 条目写」两步，与 N4 先例一致。
  3. Yjs 嵌套类型经 `root.get(key)` 取值（非链式 `getMap`）——探针 API 修正。
- `plainDataEquals` 深比较分支经**受控写面结构性不可达**（schema 物化恒 live 载体），经复制
  来源 plain 写动态证实双向（过滤/真变）——与 D4/ADR §5 相容，非缺陷。
- 结构实现点⑩（ws-replication `decorateLease` 的 watchMap 透传）无行为级测试消费（仓内
  ws-replication 测试均不调用 watchMap——设计 D9(b) 明示零行为面）；其类型满足性经 SA3
  门禁③（根 typecheck exit 0）与本轮 `ws-replication-api.test-d.ts` 17/17 佐证；行为级
  驱动属 T3 #389 复用该 harness 时自然覆盖。
- 首轮 C4 组合 exit 1 系临时探针自身类型错（include 命中），删除后干净——见 §7。

## 11. Verdict

**approve**。

- 设计（SA1 iteration 2 §8-A–G）声明改变的数据流全部按设计变化：建立通路与六门拒绝位
  （含 ③b ROOT 载体门）、事务级推导（一事务一通知/同 key 合并/FIFO）、无过滤 origin 两态
  分类（'replication' 经真实复制会话动态触发）、真变判定（标量过滤/live 保守/plain 深比较
  双向）、槽外异步分发、有界队列溢出降级（实测触发且流形状与 ADR §6 逐字一致）、
  C-3/O-3/R9 边界、lease release 与 runtime close 清理。
- 设计声明保持的路线全部保持：readData 四键/窗口读/守卫门/导出面/键集守卫/P0/复制
  wire——110/110 绿 + `git status` DENY 域零触碰。
- 状态机转换与关键值正确；禁止状态（失败半登记、退订/释放/关停后投递、静默建立、
  无覆盖丢失、close 后复活）均未出现。
- 错误沿设计路径传播（六稳定拒绝位 + 三 lifecycle 通道），cleanup 三路径均达 quiescence。
- 临时诊断（单一探针文件）已删除；post-removal 复跑同值；`[SA7-DATAFLOW]` 于改动文件
  零命中；工作树与 SA4 已审状态逐字一致。
- SA4 verdict = approve，本轮独立动态验证未发现任何 fail——不上调不下调，维持 **approve**。
