# task_issue-421 SA9 Standards 终审 — Edge 公共工厂：accept 双入口 + OPEN 准入管线 + sequence 盖章（spec #415 T4）

- 角色：SA9（独立 Standards 审查者；与 SA1–SA8 无会话继承）
- 被审对象：**已提交交付 diff `f40d016`「feat(ws-replication): add hub replication edge factory」**（父提交 `7039f6dae8e7d29f0c929492f0ca2119bc63afaa` = Authoritative Parent PR #416 head，亲测为直接祖先）
- Issue：#421（state=open）；Owner 评论 REST 快照 = 空数组（dispatch 明示）——无评论级要求、无 override 来源
- 评审方式：静态审查——全文读取设计（732 行）/SA2/SA3(迭代 2)/SA4(迭代 2)/SA8 三份冲突报告，逐文件亲读交付 diff 与生产源码（`hub-edge-host.ts` 955 行全文、`hub-upgrade-admission.ts` 全文、`hub-connection.ts` 迁移面、`index.ts`、`CONTEXT.md` diff、C5a diff、7 个新测试文件的头部/夹具/抽查），并对 DENY 面做 git 级零 diff 亲测；**按 SA9 纪律不运行测试、不启动服务、不修改任何产物**（文中绿灯数字均为 SA3/SA4 报告值，未由本轮复算）
- 不审查面：Issue 需求是否完整实现（SA10 职）；动态验收（SA7 职）
- **Verdict：`approve`**（无 BLOCKER、无 MAJOR；4 条 MINOR 非阻断观察见 §9）

---

## 1. Reviewed inputs

| 输入 | 状态 |
|---|---|
| 任务简报 `task_issue-421.md`（Issue 正文 AC1–AC6；Comments 空） | 已读 |
| 设计 `task_issue-421_design.md`（迭代 1，732 行；§7-D1..D7/§8.2 伪码/§10 ALLOW-DENY/§12 验收映射） | 已读全文 |
| SA2 攻击评审（approve；R1–R6/N1–N6 核销 + M1–M5 非阻断） | 已读 |
| SA3 实现报告（迭代 2：F1/F2 最小修复 + OAP-C11 回归 + GATE 报告值） | 已读 |
| SA4 静态评审（迭代 2 approve；F1/F2 关闭 + M1–M7 非阻断） | 已读 |
| SA8 三份报告（task 门禁 clear；设计后复审 clear + A1' 四类 diff 义务；implementation 复查 clear + O1–O5） | 已读 |
| SA6 契约（approve；EF/OAP/RK/ER/WS/LC/GATE 条目与 §12.0 交付路径） | 已读关键节 |
| 决策集：ADR 0032 全文、协议 §1/§2/§3/§13/§14/§19、CONTEXT.md:225–237、根/`docs`/`packages/ws-replication` 三级 AGENTS.md | 已读 |
| 交付 diff（`git show f40d016` 全量 name-status/stat + 关键文件逐行） | 亲测 |

## 2. 文件范围审查 —— ✅ 与设计 §10 ALLOW/DENY 逐项相符

交付 diff（剔除 wiki/raw 任务档案与 artifacts/ 证据日志两类流水线资产后）共 13 个路径，与设计 §10 ALLOW LIST 十三行**一一对应、零越界**：

| 路径 | ALLOW 行 | 实测 diff | 判定 |
|---|---|---|---|
| `packages/ws-replication/src/hub-edge-host.ts`（新增 955 行） | 行 1 | 公共工厂 + 8 公共类型 + `HostSessionAdapter` + 两常数 | ✅ |
| `packages/ws-replication/src/hub-upgrade-admission.ts`（新增 123 行） | 行 2 | 四符号（`MAX_EARLY_FRAMES`/`EarlyFrameAdmission`/`installEarlyFrameAdmission`/`closeAdmission`）**逐字搬迁含注释**；模块级导出、**不进 index.ts/testing.ts**（亲测两文件零引用） | ✅ |
| `packages/ws-replication/src/index.ts`（+16） | 行 3 | 值导出恰 +1（`createHubReplicationEdge`，附 issue 锚注释）+ 8 个 `export type`；既有 11 运行时导出零改名零删除（C5a 清单反向佐证） | ✅ append-only |
| `packages/ws-replication/src/hub-connection.ts`（−110/+5） | 行 4 | **仅导入迁移**：删除搬迁四符号定义 + `import { installEarlyFrameAdmission }`；`grep '^export'` = `createHubReplication` 单键；accept/acceptTrusted 门序逐行重读零行为差（:150–269 亲读）；消费点 :163/:248 共享搬迁后单点 | ✅ 行为/键面零变化 |
| `…-issue418-edge-session-split-contract.test.ts`（+1） | 行 5（R1 限定行） | 恰一行 `+  'createHubReplicationEdge',`，字典序位 `'createHubReplication' < …Edge < …Plugin'` 正确；零删除、断言语义（`toEqual` 精确等值）不变 | ✅ 授权边界内 |
| 7 个新测试文件（6 test + 1 test-d，+4371 行） | 行 6–12 | 文件名与 SA6 §12.0 交付路径逐字一致 | ✅ |
| `CONTEXT.md`（4±） | 末行（A5 边界） | **限「复制 Edge」词条**：正文追加宿主出面句 + `_Avoid_` 增补「在宿主缝外自建连接级准入管线」；SessionHost 词条（:229–231）机制措辞零触碰、路由键词条零触碰、全文零处援引 ADR 0032:22 机制句字面（R7'' 禁令） | ✅ |

**DENY 面零 diff 亲测成立**：`git show f40d016 --stat -- packages/replication-protocol/ hub-edge.ts hub-split.ts hub-session.ts hub-namespace.ts frame-io.ts backpressure.ts liveness.ts observer.ts defaults.ts validate.ts types.ts plugin.ts peer-connection.ts peer-namespace.ts testing.ts docs/ apps/` = **空输出**。`FROZEN_TESTING_EXPORTS` 面不受扰。package.json 未触碰。

wiki/raw 档案（设计/SA2/SA3/SA4/SA6/SA8 家族 13 文件）与 artifacts/ 三份 SA6 日志随票入库，与仓内既往任务（task_191/228 等）同一惯例。`git status` 残余两项未跟踪（任务简报 `task_issue-421.md`、`sa6-issue421-runner-trigger.log`）为流水线输入/输出，非交付面缺陷。

## 3. 架构一致性与模块责任（三级 AGENTS + ADR 0032）—— ✅ 无违规

| 条款 | 落实证据 | 判定 |
|---|---|---|
| 协议状态机单份（ADR 决策 1；包 AGENTS「Preserve protocol ordering and FSM invariants」） | Architecture-C：工厂包装**零 diff** 的 `HubReplicationEdgeImpl`，每 accept 经构造期 `sessionFactory`（`hub-edge.ts:175` 同步调用，亲读）注入 `HostSessionAdapter`；连接级 FSM（HELLO/sequence/路由/drain/liveness/五路收口）零复现 | ✅ |
| 普通工厂、非 Cordis 插件、无 Registry 依赖（ADR 0032:41） | `hub-edge-host.ts` import 清单（:30–68）全为协议包/包内模块，零 Registry/Cordis；grep `worker_threads|MessageChannel|MessagePort` = 零命中（决策 2 零传输依赖） | ✅ |
| 受信身份绑定（包 AGENTS；协议 §2） | `acceptTrusted` 绑定 `identity.peerInstanceId`；`accept` 门序逐点复刻单体（门 1 缺凭据 → 门 2 无认证器 fail-closed → 门 3 早到帧单点 → auth timer → 门 4 verifyToken 恰一次 → 微任务让位 + 迟拒复查 → 文法 → 门 5 世界变化 → 分配；6/7 次序 = R6 修订后单体序，与 `hub-connection.ts:304–315` 亲比对一致）；无门 0 = 设计显式登记差异（工厂无服务面） | ✅ |
| admission 四窗口有界（包 AGENTS「Keep admission bounded…observable concurrency contracts」） | 早到帧 16（搬迁单点）+ pending 帧 16 + 并发 OPEN 4；SA4 迭代 1 发现的 no-sink 重解析旁路（F1）与预算泄漏（F2）已修复并带 OAP-C11a..d 回归——三处入口（首开/合流/重开）上界纪律一致；账目递增三处、递减单点 `releaseBuffer` 四路到达（SA4 §2 账目复盘，本轮亲读 :485–507 属实） | ✅ |
| 注入 seam（timer/limits/timeouts/observer/clock） | 构造期 `validateInstanceId`/`assertCallable`/`resolveLimits`+`validateLimits`/`resolveTimeouts`+`validateTimeouts` + 分块族条件链（与单体 `hub-connection.ts:179–205` 同款）；`verifyToken` 类型可选 ≠ 运行时容错（门 2 fail-closed，N2 措辞） | ✅ |
| 生产 API 经 `src/index.ts`；测试控制归 testing 面 | 公共面 = index.ts 唯一出口；`HostSessionAdapter`/两常数模块级导出仅供白盒守卫测试（OAP-C9b 授权注入点），经相对路径 `../src/hub-edge-host.js` 消费——与 issue418 structure.test 等既有惯例同形；testing.ts 零触碰 | ✅（SA3 deviation #1 已登记） |
| §21 停机权威/生命周期 | 句柄 `close`/`settle`/`beginReauth`/`revokeNamespace` 全部委托内部 edge 既有单点；`onConnectionDropped` = no-op（工厂无服务面连接清单，SA2-M2 登记缺省） | ✅ |

**命名冲突处置（设计 D1）**：内部 `hub-edge.ts` 模块级 `createHubReplicationEdge`（structure.test L617 锚）保持原名；公共名归 index.ts 导出面；两模块头注释互指 + 导入别名 `createEdgeConnection` 消歧（:26–28/:34 亲读）。✅

## 4. 单一事实源 —— ✅ 无第二事实源

| 事实 | 权威源 | 派生面 | 判定 |
|---|---|---|---|
| 连接级 FSM/authorize 真实调用/台账 | 内部 edge（零 diff） | 适配器经 `port.openAdmission` 拉取结局（三分），台账缺失 reject → ns `INTERNAL_ERROR`（R4a，对齐单体 shim 路径） | ✅ |
| 早到帧 admission 机制 | `hub-upgrade-admission.ts` 单点 | `hub-connection.ts` + `hub-edge-host.ts` 两消费方共享（#190 纪律保持；逐字搬迁亲比对） | ✅ |
| 出站 sequence | `OutboundQueue.emitOne` mux 点单点盖章 | egress 五成员 = `HubSessionEdgePort` 等价重暴露（sendData 前置门次序 = `hub-session.ts:210–216` 逐点） | ✅ |
| 连接键 | 工厂计数器 → 内部 `connectionCounter` → `connectionId` | `connectionKey` 同串（D5 单一键系统；`hub-edge.ts` 配置注释亲读） | ✅ |
| 错误码/帧构造/观测折叠 | 注册表 + `namespaceErrorFrame` + observer 单点 | 全量大写字面量审计：新源码仅 6 个字面量，全部在册（`errors.ts:114/117/122/123/128/140` 亲核），**零新码零新事件型** | ✅ |
| 准入状态表 vs edge 台账 | 台账（锁步） | 适配器表（OAP-C8 锁步断言在档）；防御分支（rec==null → 合成）与 `withChannel` 同形 | ✅ |

## 5. 生命周期对称性 —— ✅ 对称闭合

- accept 分配 ↔ 句柄 `close`/`settle` + 内部 edge 五路收口 + `cleanupAll → settleTail → onConnectionDropped`：适配器 `close()` 逐 established sink 归一（`.then(→undefined, →undefined)`，同步 throw 同归）使 settleTail 恒 resolve、`onConnectionDropped` 必达、零 unhandled rejection（R5/ER-3 结构性核验，:641–653 亲读）。
- 准入记录四类终局（denied/failed/no-sink/established）+ 迟归路径（`finishTerminalSilently`/卫生通知）**全部经 `releaseBuffer` 单点归还帧预算**——迭代 1 唯一不对称点（no-sink 泄漏）已由 F2 修复闭合（释放先于 phase 迁移 + `discardBuffer` 缓冲在场守卫，:459–467/:495–499 亲读）。
- fire-and-forget 续体（`runSettleAdmission`/`runResolve`）入口 `.catch` 兜底 + 函数体全路径分类（:391–397/:405–436）——`hub-connection.ts:136–141` 识别的 unhandledRejection 进程级风险面不引入新实例。
- timer 纪律：auth timer 任何出口即清（:835/:843）；hello/reauth/liveness timer 全在零 diff 内部 edge 继承。
- sink 四成员异常纪律写入发布即冻结的契约注释（:79–89）并在投递点/归一点逐条落地（deliverOpen/deliverFrame 防御 catch → 1011 终局；`terminateNamespace` 归一恒 resolve = 单体 `terminationSettled` 同形）。

## 6. 测试质量标准 —— ✅ 达标

| 检查点 | 实测 |
|---|---|
| 真实 runner 入口 | 6 test 命中根 vitest `include`（`packages/*/test/**/*.test.ts`）；1 test-d 命中 `typecheck.include`；包 tsconfig `include` 含 `test/**/*.ts`（tsc 程序覆盖） |
| 纪律 grep | 7 文件零 `skip/only/todo/readFileSync/process.env`；零源码字符串断言（断言 = wire 原字节/close code+reason/observer 事件/宿主回调计数/投递记录）；零 mock 被测对象（stub 只在宿主缝另一侧；OAP-C9b 白盒注入为设计授权点） |
| 覆盖映射 | 文件头覆盖清单逐条对应 SA6 §12.1–12.6（EF/OAP/RK/ER/WS/LC）+ 设计增补（OAP-C4b/C9/C10）+ SA4 回归（OAP-C11a..d）；负控齐备（恰满不收口、上界内重解析照常、ERROR 永不合成、连接级 ERROR 不路由等） |
| 红绿纪律 | OAP-C11 先红后绿（SA3 §7 红灯基线：修复前 3 failed | 1 passed，失败形态与 F1/F2 静态模型逐点吻合——SA4 §2 核验）；既有 36 OAP 用例纯追加零触碰（SA4 抽查亲证）；GATE 报告值 = 84 文件/686 测试全绿（682 基线 +4，只增）、tsc exit 0、replication-protocol 空 diff（**SA3 报告值，SA9 未复算**，见 §9-O1） |
| 确定性 | 假 timer 手工推进 + 内存双工 transport + `settle/settleUntil` 微任务泵 + `collectUnhandledRejections`——与仓内既有 harness/driver 基建同源 |
| 类型面 | test-d 逐成员 `expectTypeOf` 锁定（工厂签名/双入口/句柄十成员含 D7 `channels`→`namespaces` 裁决/egress 五成员/sink 四成员/配置九成员含 `verifyToken` 可选性的无键字面量证明）；负控 = 既有导出签名不变；`ReplicationMessage` 来源包声明（不转出口决策入注释） |

## 7. 冻结面与决策文本纪律 —— ✅ 保持

- wire/注册表/close 分类：`packages/replication-protocol/**` 零 diff；收口码全部在册（1008 policy / 1011 internal / 1002 协议错，reason 恒 `'protocol-error'` 或升级闭集）——GATE-C4 成立。
- #418 完成门：structure.test L616–619 零改动（模块键面不变：hub-connection `^export` 单键、edge/session/split 零 diff）；C5a 恰一行授权追加（SA8 设计报告 §4 裁决链：ADR 0032:41+43 + AC1 + 包 AGENTS——非 override）；L616 `import 不进 Object.keys` 机制亲证成立。
- ADR/协议文本零 diff；R4'' 就地了结且账目正确；R5''/R7'' 边界维持（零 worker 依赖、机制句零援引、SessionHost 词条零触碰、T5 附录未提前未推迟）；R8'' 六条重触发清单逐项零触发（SA8 implementation 报告 §3 行 16，本轮对交付 diff 复核同值）。
- 注释风格：全量中文 + issue/ADR/协议/设计锚（与包内既有风格同构）；`assertCallable` 的 TypeError message 恒定不回显传入值（`validate.ts` 同款纪律）。

## 8. 与上游裁决链的一致性 —— ✅ 无「先改后补票」

交付 diff 的四类授权 diff（SA8 A1' (a)–(d)）经逐项亲测**全部在授权边界内且与裁决文本逐字一致**；SA4 迭代 1 的 F1/F2 required change 在授权单点（`HostSessionAdapter` + OAP 契约测试）内完成，未扩大触碰面；SA2 R1–R6/N1–N6、SA8 A1–A5 的实现落点与 §15 映射、SA3 §4 落实表互证相符。裁决链（SA8 → SA6 → SA1 → SA2 → SA3 → SA4 ×2 → SA8 impl）完整可追溯。

## 9. Non-blocking observations（MINOR，均不阻断 approve）

1. **O1（流程挂账，非 diff 缺陷）**：根级门禁（根 `pnpm typecheck`/`pnpm test`、`apps/yjs-server` 冒烟、非 memory transport 交叉驱动）为 SA3 §8/SA4 §11 明示的 deferred 动态验证项，归 SA7/finalize 职；本报告全部绿灯数字为 SA3/SA4 报告值，SA9 按纪律未复算。包 AGENTS「wire or lifecycle change → root gates」义务在流程链上仍有落点，无丢账。
2. **O2（设计文本内部一致性，routing: SA1）**：设计 §8.2 伪码 no-sink 行缺两道上界注记（M7）、首开分支占位项不过帧预算检查（M6：峰值 = 17 × maxFrameBytes 单次 +6.25% 有界越界，非复合放大；SA8-O3 已裁决有界义务成立）。实现与**批准设计正文/伪码逐形一致**，不构成实现偏离；若 SA1 裁出代码变更，该新 diff 自带新一轮 SA8 implementation 复查（SA8-O3 已注明）。
3. **O3（观测面可选字段）**：适配器三类事件不附 `connectionId`（SA4-M1/SA8-O1 同案）；字段集 append-only 可后补，零冻结面违例。
4. **O4（宿主协作面文档化残留）**：SA2-M4/M5（established re-OPEN 应答义务、漏调 `namespaceSettled` = 等 deadline 的降级语义）在 D2 接口注释已有体现（:92/:124），SA4 维持登记为动态验收裁决项；属首发布契约的理解成本，非行为缺陷。

## 10. Verdict

**`approve`**。交付 diff 对仓库与工程标准的符合性经独立静态复核成立：

- 文件范围 = 设计 ALLOW LIST 十三行逐项相符，DENY 面零 diff 亲测；四类授权 diff 全部在裁决边界内。
- 架构惯例：协议 FSM 单份（零 diff 包装）、机制单点（早到帧/authorize/盖章/帧构造/观测折叠/账目递减）、注入 seam、普通工厂无 Registry 依赖、append-only 公共面。
- 生命周期对称：四类终局 + 迟归路径全部归还预算、恒 resolve 纪律、零 unhandled rejection、timer 全清。
- 测试质量：真实入口、零纪律违例、负控/红绿/锁步/parity 齐备、断言面 = 运行时行为。
- 决策文本纪律：零新错误码、零 wire 变更、ADR/协议/CONTEXT 边界（R7''/A5）全部维持。
- 无 BLOCKER、无 MAJOR；4 条 MINOR（§9）全部已具名路由（SA7/SA1/动态验收），不构成本轮发布障碍。

`requiresConflictRecheck`：**false**——SA8 implementation 复查（clear，迭代 1）已对同一交付内容闭合全部决策面核对（其 §10 判 false 本轮沿认）；本轮未发现新增决策面。

— SA9（Standards），迭代 0，基线 `7039f6d` + 交付 `f40d016`。
