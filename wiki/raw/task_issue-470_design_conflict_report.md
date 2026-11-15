# SA8 设计后冲突复查 — issue #470：Cordis rc.12 双形态 Root tracer bullet（design 复审，iteration 1 定向核销）

1. **Reviewed subject**: design（`wiki/raw/task_issue-470_design.md`，iteration 1 修订稿 684 行全文逐节复审；重点 §5.1 safeGet 判据与显式裁定 + C-R4a–d 映射表 + `safeReadChannel` 骨架、§8.4 物化并集、§8.6 `ws-package`/`root-test` cell、§8.8 runner、§13 AC 矩阵、§14 TDD 红灯证据纪律（D10/D11）、§15 G1′/G9、§16 锚点、§19 R1–R9 表、§20 修订映射、§21 OPEN）。
2. SA8 dispatch：`sa-7d51b911-d8ca-4f3d-87e1-845f0d863d28`，iteration 1；触发依据 = 本 SA8 iteration 0 复查 verdict **reject**（RA-1/RA-2 必修 + §3 特别裁定 C-R4a–d 绑定约束）已由 SA1 定向修订，且 SA2 评审 F4 提出第四类失败语义面（read-throw 裁定）待裁；HEAD `279dba4ac81b7c7520e3d0b87b5c4d621a86a517`（worktree `mabf/issue-470`，本会话核证：工作树仅 `wiki/raw/**` untracked，src/test/docs/packages 零实现 diff——与「设计未实现」前提一致）。
3. 本报告为原位更新版：iteration 0 的核销结论与 RA/C-R4 项在本版中被逐条重新核销（§3），不堆叠历史结论；iteration 0 全文裁决链（R1–R9 原始绑定、§3 归一裁定）仍作为约束基准被引用。

---

## 1. Inputs and decision set

| 输入 | 位置 | 本会话核对方式 |
|---|---|---|
| 被评审设计（iteration 1） | `wiki/raw/task_issue-470_design.md` | 全文逐节（684 行） |
| 本 SA8 iteration 0 复查 | `wiki/raw/task_issue-470_design_conflict_report.md`（旧版，本文件前身）§2 R1–R9 表 / §3 C-R4a–d / §11 RA-1/RA-2 / §12–§13 | 全文（修订前快照已读） |
| SA2 设计评审 | `wiki/raw/task_issue-470_sa2_review.md`（F1–F3 MAJOR；§14 F4–F10 非阻塞；§13/§16 verdict reject） | 全文 |
| SA8 前置门禁 | `wiki/raw/task_issue-470_conflict_report.md`（R1–R9、O1–O7、§5 冻结面含「稳定错误文案纪律」） | 全文 |
| Owner 原文 | `wiki/raw/task_issue-470.md`（8 checkbox L21–L28；L17 尾句 AC9；Comments 空 L35–L36——本会话再核，owner 仍零表态） | 全文 |
| SA6 验收契约 | `wiki/raw/task_issue-470_sa6_acceptance_contract.md`（§4.1 三基线 Runtime Root 探针表、§12.3、§12.4 gate #1 L422–L427、§12.5、§15、附录 A） | 关键节逐字 |
| ADR 0035 | `docs/adr/0035-cordis-rc12-root-compatibility.md`（状态**提议**，未被 superseded，构成约束；§2 L45–L58 决策形态逐字） | 逐字（本会话重读） |
| 交叉 ADR | 0006（L88 root 绑定/dirty notification）、0009（L103 有序 disposer）、0012（L5 plugin 所有权/不销毁上游、L33–L37）、0023（L45 访问器 + freeze 构造、L90–L92 guard-proxy 回归验收） | 相关条款本会话重核 |
| CONTEXT.md | 「服务表面（service surface）」词条 | 术语基准（无演进需求） |
| 模块契约 | `packages/ws-replication/AGENTS.md`（Verification 节 L25–L27：focused tests + 包 typecheck + 根 `pnpm typecheck` + 根 `pnpm test`）、persistence/dsh-persistence/namespace-registry AGENTS | 全文 |
| 代码/仓库事实 | 根 `package.json` scripts（`test` = `NODE_OPTIONS=--conditions=nomicore-source vitest run --typecheck`；`typecheck` 15 project 本会话重数确认）、三 entry 包 package.json 依赖面与 src 的 `@nomicore/*` bare import 清单、`packages/*/package.json`（14）+ `apps/*`（1）+ `domains/*`（1）单层布局、`git rev-parse HEAD` / `git status --porcelain` | 本会话逐处 |

---

## 2. iteration 1 复查总览

| 复查项 | 结论 | 详见 |
|---|---|---|
| RA-1（B1 门禁载体 + 锚点失实） | **已关闭**（三小项全落；R3 四件套每件有执行载体且可为 SA10 核销） | §3.1 |
| RA-2（tsconfig/vitest 机械 gate + G1 扩展） | **已关闭**（G9 逐字落实、豁免论证成立；G1′ 保义扩展成立） | §3.2 |
| SA2 F4 read-throw 裁定面 | **可接受**：与 C-R4a–d 自洽、与 ADR 0035 §2 字面及冻结面自洽；分类 **implements-existing-decision**；**无需 owner 升级**；O4/O6 及「硬失败」变体零回归 | §3.3 |
| R2 迁移面仍封闭 | **成立**（§11.1 条目数零变化；新增 cell/常量/gate 全在 N9/N11 文件内部） | §3.4 |
| R1/R4–R9 回归 | **零削弱**（R1 更强、R8 因锚点改指而完整落实、root-test exit 2 语义不产生假红/假绿、「绿不得抵销红」仍成立） | §3.5 |
| 新冲突 / OPEN 标注 | **无新决策冲突**；§21 OPEN 项标注诚实，未冒充已核销 | §3.6 |
| Verdict | **clear**（实现前必修：无） | §9 |

---

## 3. 逐条核销表

### 3.1 RA-1 核销（R3/R8 证据载体）

| 子项 | 要求（iteration 0 §11） | 修订稿落实位置 | 核销 |
|---|---|---|---|
| ① B1 显式 cell 运行 4 fixture | `--suite ws-package` 型 cell：4 具名 fixture 实跑、`--passWithNoTests=false` + 逐文件存在预检、纳入 `--all --matrix` | §8.6 `ws-package` 行（4 具名文件在 **B1 workspace** 内 vitest `--root <ws>` 逐文件 ×4；预检双保险；evidence `.cache/…/evidence/B1/ws-package.json` 含逐文件预检结果与测试计数）；§8.8 runner 契约（`--suite ws-package` 仅对 `--baseline B1` 为验收 cell）；§13 AC6 行；§14 步⑤；§17-1（`ws-package @ B1` 入交付验证序）；`--all --matrix` 组成明列「B1 专属 `ws-package`」且「只对 B1 列标记必绿」——与 R3 第 4 分「B2/B3 跑通属允许附加证据、非验收条件」精确相容 | **已关闭** |
| ② 根 test 交付步 | 默认布局 `pnpm test` 或等价 vitest 全量命令 + 证据落位 + 失败语义 | §8.6 `root-test` 行：`NODE_OPTIONS=--conditions=nomicore-source node <repo>/node_modules/vitest/vitest.mjs run --typecheck`（cwd=仓库根；本会话核对根 `scripts.test` 逐字等价、env 逐字保留、不调裸 `pnpm`——G16/I4 论证）；§8.8（`--suite root-test` 免 `--baseline`，evidence `baseline:'default'`）；§14 步⑤；§17-1/-3（任一红 ⇒ 交付阻断，不得以矩阵其余绿抵销） | **已关闭** |
| ③ 「B1 必绿」锚点改指 | §6 末段与 §16 首行锚点由失实的「AC6 B1 cell 即证」改指实跑 cell | §6 末段与 §16 首行均改为「锚点 = §8.6 `ws-package` B1 cell（该 cell 在 B1 workspace 内实际运行本文件；`root-test` 默认布局全量复证）」，并保留修正记录（「iteration 0 曾把该锚点指向并不运行此文件的 AC6 B1 cell，失实，已按 RA-1③ 改指」） | **已关闭** |
| R3 四件套执行载体 | focused tests / 包 typecheck / 根 typecheck / 根 test 每件有载体、SA10 可核销 | §19 R3 行 + §18 I6 行逐件映射：focused tests ⇒ `ws-package` cell；包 typecheck + 根 typecheck ⇒ §8.8 `--mode typecheck` 15-project cell（清单含 `packages/ws-replication/tsconfig.json`，B1 列）；根 test ⇒ `root-test` cell。四件均落 evidence JSON + 入矩阵，SA10 有可复核锚点 | **已关闭** |

### 3.2 RA-2 核销（R1 反掩蔽机械化）

| 子项 | 要求（iteration 0 §11） | 修订稿落实位置 | 核销 |
|---|---|---|---|
| G9 tsconfig/vitest 零 diff gate | `git diff --exit-code $BASE -- tsconfig.base.json tsconfig.typecheck.json vitest.config.ts 'packages/*/tsconfig.json' 'apps/*/tsconfig.json' 'domains/*/tsconfig.json'`（建议 ws-replication 可豁免） | §15 G9 **逐字落实**（pathspec 与建议一致，未豁免）。豁免论证成立：`packages/ws-replication/tsconfig.json` 同时落 G3 allowlist 与 G9 零 diff pathspec，**零 diff ⊂ allowlist**（严格更紧、无矛盾），不豁免即最严检查。G9 是 `--exit-code` 零 diff 断言，**不给「改 tsconfig」开口子**——恰恰封死 skip/skipLibCheck 扩张/include 删项/新增 paths 的全部掩蔽载体（载体均在 tracked tsconfig/vitest.config）；runner 对 `passWithNoTests` 的覆写在 CLI 层（`--passWithNoTests=false`），config 被锁死不影响 CLI 覆写生效 | **已关闭** |
| G1 → G1′ manifest 扩展 | 建议附加其余包 `package.json`（超集不违反 R7(d)） | §15 G1′：pathspec = `pnpm-lock.yaml package.json 'packages/*/package.json' 'apps/*/package.json' 'domains/*/package.json' artifacts/`。本会话对照 SA6 §12.4 gate #1 原文（L422–L427）：原六项（pnpm-lock/根/三包 package.json/artifacts）**逐项保留**在扩展集内；「原样 = 不放松」的保义论证成立（超集只加面不减义务）。本会话核对仓库布局：14 包 + 1 app + 1 domain 均单层，glob `*/package.json` 无遗漏无嵌套盲区。R7(d) 不被违反 | **已关闭** |

### 3.3 SA2 F4 裁定面（本轮核心）：§5.1 对 read-throw 的显式裁定

修订稿裁定原文（§5.1「safeGet 判据与显式裁定」）：通道存在性判据 = 「该 key 的 `Reflect.get` 读取**成功完成**且返回值非 null/undefined」；「symbol 读取抛错 + legacy 可读」⇒ 归一为 symbol 缺席 ⇒ 读同 host legacy ⇒ legacy 合法则 **arm legacy**；「双通道读取皆抛错」⇒ 归一为双通道皆缺席 ⇒ 稳定单句 throw（D10）；pin 用例 D11（base 即绿）防实现者把 read-throw 误做成硬失败或异常泄漏。

**(a) 与 C-R4a–d 自洽性 —— 自洽，四条全守住：**

- **C-R4a ✓**：`safeReadChannel` 的 try/catch 收窄到单次 `Reflect.get` 本身（骨架 §5.1 L90–96 本会话逐行核对）；`assertRootTimerShape` 在 catch 之外被调用（两通道分支各一次）；host 间级联（`??` 链）与 `throwRootTimerUnavailable()` 均在函数体顶层、无任何 try/catch 包裹。形状断言 throw 原样穿透。
- **C-R4b ✓**：「symbol 读取抛错 ⇒ 归一为 symbol 缺席 ⇒ 读同 host legacy」**正是** C-R4b 推进链的第一步（同 host 另一通道）的合规执行；「下一 host（ws-replication 级联）⇒ 最终稳定单句 throw」逐步可对。没有引入第四种结局——「读取被拒 = 硬失败」才是 C-R4b 之外的第四种结局，修订稿 §5.6 备选表末行已显式否决，且 D11 pin 使该变体实现即红。
- **C-R4c ✓**：catch 的唯一动作 = `return undefined`（语义 = 通道缺席），该返回值只被「继续推进或最终 throw」消费——「arm legacy」是**继续推进**消费缺席结果后的正常解析，两个 seam 的出口仍严格二选一（已验证形状的 rootTimer，或 apply 期同步稳定 throw），不存在把 undefined 交给调用方继续运行的路径。
- **C-R4d ✓**：AC5 生产通道 sentinel（symbol 可读时 legacy getter 读取数 = 0；B3 只 arm symbol）与 `--fault legacy-shim` 负控（F9 同受控 ctx 落实）原样保留（§8.5/§8.7/§13 AC5 行）。sentinel 判据与裁定**无相互干扰**：「symbol 可读」= 读取成功完成——read-throw 不落入 sentinel 前提，sentinel 仍精确承载 R4 字面（symbol 读取成功时 legacy 零读取）。
- 判据边界泾渭分明：**malformed**（读取成功、返回值形状不符）→ 立即 throw 不回落；**read-throw**（读取本身未完成）→ 归一缺席可推进。SA2 F4(b) 的关注点（malformed 不会被伪装成缺席）成立——形状断言只对读取成功返回的值执行。

**(b) 与 ADR 0035 §2 字面形态及冻结面「稳定文案」纪律 —— 自洽：**

- ADR 0035 §2 的字面形态（`Reflect.get(symbol) ?? Reflect.get('root')`，无 try/catch）**未定义**「读取抛错」形态——`??` 只合并 nullish，不捕获异常。ADR §2 L54 的义务是语义层：symbol 优先、仅 symbol 缺席才读 legacy、缺席/形状不符响亮失败、无 ambient。消费者对「被拒读取背后是否有值」**不可观测**：归一为「缺席」是唯一不引入臆测的分类，且归一后走的是 ADR 已定义的推进与失败路径；反向分类（read-throw = 独立硬失败面）则把 proxy 噪声升级为失败面，直接违反冻结面「新 Root 通道失败用稳定文案，不得随 ctx 形态漂移成 TypeError/proxy 噪声」——SA6 §4.1 实测 rc.12 plugin fiber 的 legacy 读即抛 `cannot get property "root" without inject` 型 proxy Error，不归一则该异常原样泄漏。
- **可达性定性成立**：SA6 §4.1 三基线探针表（本会话复核）——symbol 读取在 4.0.1/4.1.0/rc.12 的 root ctx 与 plugin fiber **均不抛**（返回 undefined 或 root）；唯一会抛的真实读取（rc.12 fiber 的 legacy 读）仅在 symbol 已缺席时可达、而届时 symbol 读已成功返回 root，根本到不了 legacy。故 read-throw 形态只经测试内受控 Proxy 构造，修订稿将其定性为「确定性支持面而非行为变更」**有据**；真实基线上 R4 字面行为不被裁定稀释（仍由 AC1(a) sentinel 承载，SA2 F4(iii)）。
- 冻结面纪律闭环：单通道拒 → 推进；双通道皆拒 → 同一稳定单句（§5.2 表 D10 行共用）；任何路径无 proxy 异常泄漏（D11 断言「proxy 异常零泄漏」）。

**(c) 分类：implements-existing-decision；无需 owner 升级、无需 override。**

- iteration 0 §3 已裁定「读取被拒归一为缺席**不构成对 R4 的偏离**」（推理链第 2/3/4/5 点）；本轮增量只是把该归一在「另一通道可读」分支的结局显式化（arm legacy）——这是 C-R4b 推进链（「按缺席处理」后只允许推进：同 host 另一通道 →…）的**直接推论**，无新自由度、无新决策面。相对基准 = SA8 §3 裁定 + C-R4a–d（既有约束集合）与 ADR 0035 §2 L54 义务。
- 不是 evolution-required：裁定不改变任何 ADR 条款、wire/schema/公共 API/生命周期/状态机；ADR §2 的代码块是决策形态的最小示意而非逐字节实现义务，`safeReadChannel` 保持 `??` 的优先级与推进语义不变，仅把「读取抛错」纳入「缺席」的判定。若未来要把 read-throw 改定为独立失败分类，那才是需 ADR 演进的新决策——本裁定不创设该义务。
- 无需 owner 升级：owner 关切（AC1：symbol 优先、legacy 兜底、loud fail、无 ambient）逐条不被违反；形态在全部真实基线不可达，pin 仅防实现者错误。SA2 F4 三点 (i)(ii)(iii) 逐一落实（判据句落 §5.1；pin 落 D11 + D10；sentinel 保留）。

**(d) 被否决选项变体回归 —— 无回归：**

- **O4（cast-only/tsconfig 压静）**：无关——read-throw 归一是**运行时失败语义**，通道迁移与全部行为判据（D1–D11、sentinel、四负控）照常执行；§5.3「TS2576 消除机制 = 源码不再出现 `ctx.root` 属性访问」不变，G9 进一步封死配置面。
- **O6（symbol-only 硬切/升依赖）**：反向——「symbol 读抛 + legacy 可读 → arm legacy」恰是 legacy 兜底的运行；硬切 symbol-only 会在该形态 throw。§11.2 DENY manifest 面 + G1′ + §5.5 无版本分支，O6 无回归通道。
- **「read-throw 硬失败」变体**（把读取被拒做成立即 throw，含伪装成 malformed 的不回落形态）：已被 §5.6 备选表末行显式否决（违反 C-R4b 第四种结局 + 冻结面），D10/D11 双 pin 使任何该变体实现必红（反证敏感性已写入 §14 末段）。

**裁定结论：§5.1 read-throw 显式裁定可接受，无绑定修法。**

### 3.4 R2 迁移面仍封闭

| 检查点 | 结果 |
|---|---|
| §11.1 ALLOW 清单条目数 | 仍 = 6 修改（M1–M6）+ 11 新增（N1–N11），**零变化**；M1–M6 仍恰好 = persistence `service.ts` + ws-replication `plugin.ts` + 4 具名 fixture（R2 精确允许面） |
| 新增 `ws-package`/`root-test` cell | 均为 N9 `run-baseline.mjs` **文件内部**的 cell 定义，不新增路径 |
| NEW_FILES 常量 | N9 runner 内置 §11.1 N1–N11 的 11 条路径常量；物化只写 `.cache/`（gitignored），不触仓库树 |
| G9/G1′ | N11 `gates.mjs` 内部 gate 定义；G3 pathspec 未变（`packages/ws-replication` ⊆ {`src/plugin.ts`} ∪ 4 具名 test）；G9 对 ws-replication 是**零 diff 要求**而非 allowlist 扩展 |
| §11.1 同步更新 | N9 承载列已补「含 NEW_FILES 常量、ws-package/root-test cell」、N11 已补「G1′/G2–G9」——清单与正文同步，无漂移 |
| 生产面 | 零新增（D10/D11 新测试落 `packages/persistence/test/`，N1 内） |

**结论：R2 仍封闭，与 R2/R7(a) 精确相容。**

### 3.5 R1/R4/R5/R6/R7/R8/R9 回归检查

| 决议 | 回归检查 | 结论 |
|---|---|---|
| R1 | `--mode typecheck` 15-project 逐 project 留证、禁子集/删项/skip/skipLibCheck/cast 掩蔽/默认 node_modules 冒充——全部保留；G9 把文字 DENY 升级为机械封锁（**更强**）；清单仍从根 package.json 解析（G1′ 锁 manifest 零 diff 封死删 project 后门） | **不降反升** |
| R4 | G1→G1′ 与 R4 无关；本轮 R4 面修订（read-throw 裁定 = §3.3、F5 null-host 守卫、B1 捕获形态纪律）均为收紧或精化。F5 注记：`timer.ctx === null` 从现状 `?.` 的静默级联收紧为 malformed 立即 loud fail——本会话判定该收紧**只作用于不可达合成形态**（真实 TimerService 的 ctx 恒为 object；全部 fixture shim 提供 object `ctx` 或整个省略——`undefined` 仍级联、与 `?.` 逐行为等价），方向与冻结面一致（稳定文案不漂移为 `Reflect.get(null,…)` TypeError 噪声），且已入 §21(a) 失败语义申报面 | **持守** |
| R5 | §8.3 八项 provenance 零改动 | **持守** |
| R6 | §4 账本（8 checkbox + AC9 derived）零改动 | **持守** |
| R7 | (a)(b)(c) G3/G4/G5 未变；(d) G1′ 保义扩展（§3.2）；G9 新增只加严 | **持守** |
| R8 | guard-Proxy 断言面原样 + **B1 必绿锚点由失实改指实跑载体**（`ws-package` B1 cell 实跑本文件 + `root-test` 复证）——iteration 0 的「承诺在、锚点缺」缺陷消除 | **完整落实** |
| R9 | owner Comments 仍空（本会话再核 owner 原文 L35–L36）；advisory 未激活；§19 R9 行申报不变 | **持守** |
| root-test exit 2 语义（dispatch 专项） | 「仓库现成安装缺失 ⇒ 响亮 exit 2」：exit 2 = 环境性响亮失败（与 acquire/materialize 失败同语义、同非零 exit），**非 cell fail**。假绿检查：`--all --matrix` 聚合对非零 exit 一律阻断（§8.8「任一 cell fail 或缺失 → exit != 0」），不会假绿；假红检查：证据 JSON 记录 vitest exit code + logPath，环境失败与测试失败可辨识区分，不把安装缺失伪装成测试红。root-test 依赖仓库默认布局安装（B1）是 AGENTS 根 test 门禁的固有前提 | **不产生假红/假绿，可接受** |
| 「绿不得抵销红」 | §8.8 保留且新增 cells（ws-package/root-test/gates）全部纳入矩阵必含集；§17-3 失败语义（任一红 ⇒ 交付阻断，不得以矩阵其余绿抵销） | **仍成立** |

### 3.6 新冲突检查（OPEN 项与新增面）

| 检查点 | 结果 |
|---|---|
| §21 OPEN 6 项标注诚实性 | 逐条核对：① 实际 diff 面复查、② gates.mjs 首落地（含 G5 capture 可行性）、③ A-3 约束（实现期改私有 seam 文件形态 ⇒ G3 扩展 + 回 SA8 备案）、④ 红灯证据落证（SA3 双记录）、⑤ B1/F1 实现核对、⑥ F8 instrument 时机——均为**实现期核销项**，本稿未将其冒充为已核销；§20「未吸收项：无」与逐行映射核对相符（F1–F10/RA-1/RA-2/A-1–A-5/C-R4a–d 全部落实或显式转 OPEN，仅 A-3 因触发条件在实现期） |
| A-3 类触发条件 | §5.6 备选表 A-3 注记 + §21-3 双处正确标注；本设计维持 in-file 收口，与 G3 当前 allowlist 一致 |
| 新增面决策冲突 | `ws-package` cell（B1 ws 实跑 4 fixture）/ `root-test`（默认布局全量）/ NEW_FILES 并集 / G5 capture 五步流程（worktree 落 `.worktrees/base-snapshot` 符合根 AGENTS L45–L47 与 `.agents/WORKTREES.md`）/ G8 rg 范围扩展到 `packages/ws-replication/src`（M2 改动面的 AC9 形状覆盖，合理）——逐一核对**均无 ADR/规范冲突**、不触 wire/schema/持久化/状态机/公共 API（§9） |
| requiresConflictRecheck 申报 | §21 自报 true，理由 (a)（新失败语义，**含 F4/F5/B6 裁定面**）(b)（ws-replication diff 面）(c)（新执法面）——与 SA8/SA2 双方申报一致，无漏报 |

---

## 4. Decision analysis（iteration 1 增量面；R1–R9 基准项见 §3.5 与 iteration 0 §2/§6）

| Decision | Clause | Subject behavior（修订稿） | Classification | Evidence | Required action |
|---|---|---|---|---|---|
| SA8 iteration 0 §3 特别裁定 + C-R4a–d | read-throw 归一后只允许推进 | §5.1 显式裁定「symbol 读抛 + legacy 可读 → arm legacy」+ D10/D11 pin + 判据句（读取成功且非 nullish = 存在） | implements-existing-decision | 设计 §5.1（骨架 + 判据 + pin + 可达性说明）；§14 D10/D11；本报告 §3.3 | 无（实现后核对见 §8） |
| ADR 0035 §2 L48–L54 | symbol 优先、缺席/形状不符 loud fail、无 ambient | `safeReadChannel` 保持 `??` 优先级；malformed 不回落；双缺席（含双拒归一）稳定 throw | implements-existing-decision | ADR 逐字；设计 §5.1 | 无 |
| 前置报告 §5 冻结面（稳定错误文案纪律） | 新 Root 失败用稳定文案、不随 ctx 形态漂移 | read-throw 不升级为失败面（proxy 噪声零泄漏，D11）；F5 null-host 守卫复用同一稳定文案（§5.2 表） | no-conflict（纪律持守） | 前置 §5；设计 §5.1/§5.2 | 无 |
| ws-replication AGENTS Verification（L25–L27） | focused tests + 包/根 typecheck + 根 test | 四件套逐一有执行载体（§3.1 末行） | implements-existing-decision | AGENTS L25–L27；设计 §8.6/§8.8/§13/§17/§19 R3 行 | 无 |
| ADR 0035 §5 L82 + Issue L26 | 全仓 typecheck × 3 基线、不得抵销 | G9/G1′ 机械封锁掩蔽与 manifest 载体；矩阵「绿不得抵销红」扩展到新 cells | implements-existing-decision | 设计 §8.8/§15 | 无（gates 首落地属实现后核对） |
| ADR 0006 L88 / 0009 L103 / 0012 L5+L33–L37 / 0035 §3 | 调度所有权、有序 disposer、不销毁上游不变 | §5.4 零变化；F5 守卫与 read-throw 裁定只改「如何找到 root」，不改所有权/停机序 | no-conflict | 本会话重核四 ADR 条款；设计 §5.4 | 无 |
| ADR 0023 L45 + L90–L92 | 访问器 + freeze 构造；guard-proxy 回归 | §16 冻结面表 + `ws-package` B1 cell 实跑承载「B1 必绿」 | no-conflict（冻结面） | ADR 0023；设计 §6/§16 | 无 |

## 5. Overrides

| Old decision | Override authority | Scope | New obligation |
|---|---|---|---|
| —（无） | — | — | — |

修订稿未创设、未依赖任何 override（owner Comments 空且本轮再核；无 ADR 修订；无协议升级；无演进条款触发）。read-throw 裁定分类为 implements-existing-decision（§3.3c），不构成 override。

## 6. Frozen surfaces

| Surface | Must remain unchanged | Evidence（修订稿承诺） | Actual result（本次复查） |
|---|---|---|---|
| 复制 wire 协议/帧布局/状态机 | 零改动 | §11.2 DENY + G3 | 持守 |
| ws-replication 公共导出面 | `src/index.ts` 逐字节不变 | G4 | 持守 |
| 冻结服务面构造形态（ADR 0023） | 访问器 + freeze、互斥入口、公共工厂 append-only | §16 + G3/G4 | 持守 |
| persistence 公共导出面 | index/contract/lifecycle/memory/file/testing byte-identical | G2 + G5 | 持守 |
| 包清单/lock/artifacts | 与 base 逐字节相同 | **G1′ 扩展面**（超集，原义务一项不减）+ G6 | 持守 |
| ADR 0006/0009 生命周期语义 | drain/dispose/degraded/shutdown 不变 | §5.4 | 持守 |
| 「全仓 typecheck」定义 | 根 scripts.typecheck 15-project | §8.8 + **G9** 封锁 tsconfig 面 | 持守（更强） |
| **稳定错误文案纪律** | 四条既有文案逐字节不变；新 Root 失败 = 单句稳定、不随 ctx 形态漂移、与既有 regex 零误匹配 | §5.2 表（read-throw/F5/双拒共用新文案行）+ D10/D11 | 持守（read-throw 裁定不将 proxy 噪声升级为失败面——本报告 §3.3(b)） |
| guard-Proxy 断言面（R8） | 断言原样 + B1 绿 | §6/§16 锚点改指 `ws-package` B1 cell + `root-test` 复证 | **完整持守**（iteration 0 锚点缺陷已修复） |

## 7. Evolution requirements

**无。** 修订稿未触碰 wire/schema/持久化布局/状态机/公共 API/术语（§9/§21 自述，本会话逐面复核成立）；read-throw 显式裁定与 F5 守卫均落在既有决策集合内（§3.3/§3.5），不需 ADR/CONTEXT/协议修订，不需新 ADR。

## 8. Hard conflicts

**无。** 无任何与现行决策集合不兼容且无 override 的项。

---

## 9. Required actions 与结论（dispatch 第 7 问）

### 实现前必须修

**无。** RA-1/RA-2 已关闭（§3.1/§3.2）；F4 read-throw 裁定可接受且无需修法（§3.3）；R1–R9 全部成立、零削弱（§3.5）；无新决策冲突（§3.6）。被否决选项 O1–O7 零回归（O4/O6 专项复核见 §3.3(d)，其余与 iteration 0 §4 相同、修订未触碰对应面）。

### 实现后必须复查项（SA8 implementation 复查清单，与设计 §21 六项 OPEN 对齐并细化）

1. **实际 diff 面**：M1–M6 实际 diff 是否守住 §11.1/G2/G3/G9 allowlist；两处 seam 的代码语义面复审——重点核对 read-throw 裁定的实现形态（catch 只包单次 `Reflect.get`、`assertRootTimerShape` 在 catch 外、无异常泄漏、无第四种结局、无 ambient 兜底）与 B1 捕获形态纪律（两处均为 `rootTimer.timeout(callback, delayMs)` 方法调用、零 detach）。
2. **gates 首落地执行核对**：G1′–G9 在真实工作树首次运行；**G5 capture 五步流程可行性**——特别核对 `@nomicore/*` 在 base worktree 的 resolve 载体（见 advisory A′-1）；失败语义 = 响亮非零 exit 并打印 stage，不得静默降级。
3. **失败语义实现核对**：D10/D11/F5 三组用例真实落红→绿；新 persistence 文案与既有 regex 零误匹配的实现面；root-test / ws-package cell 证据 JSON 的实际落位与「绿不得抵销红」聚合行为。
4. **红灯证据纪律**：SA3 在未 commit 工作树执行 §14 步③的双记录（`filesPresent` + 红因比对），missing-file 红不得记账；D5/D6 的 B2 预期绿由首跑确证。

### Advisory（非阻塞，不构成 verdict 依据）

- **A′-1**：§15 G5 步③「`@nomicore/*` 不需链接——以 tsx + `--conditions=nomicore-source` 直载 base worktree 自身 `src/`」与同句「复用 §8.4 步 2 机制」存在读法张力：§8.4 步 2 对 `@nomicore/*` 的处理是 **symlink 至 workspace 内兄弟包目录**。本会话核实三 entry 的 src 均有 `@nomicore/*` bare import（persistence→`@nomicore/clock`；dsh-persistence→`@nomicore/persistence`(+`/testing`)+`@nomicore/clock/testing`；ws-replication→`@nomicore/replication-protocol`+`@nomicore/namespace-registry`），tsx 直载时这些 specifier 需要 node_modules 解析载体——即 farm 大概率仍需按步 2 机制为 `@nomicore/*` 建链（指向 base worktree 兄弟包），「不需链接」应理解为「不需链接至主仓安装（主仓也没有）」。该点已属 §21 OPEN-2（可行性实现期验证 + 响亮失败语义），非冲突、非必修；建议 SA3 落地时消除表述歧义，SA10/SA8 复查时按此核对。

### 是否仍需 owner 升级

**无。** 无阻塞性 Host/owner 问题；R9 advisory（owner 若表态「零 ws-replication diff」）激活条件未满足（issue Comments 恒空，本会话再核）；read-throw 裁定落在既有决策集合内（§3.3c），不需 owner 裁决。

## 10. Verdict

**clear** —— RA-1/RA-2 两项必修均已按绑定修法关闭并经逐项核销（§3.1/§3.2）；SA2 F4 提出的 read-throw 裁定面经裁定为可接受（implements-existing-decision，与 C-R4a–d、ADR 0035 §2 字面与冻结面纪律自洽，O4/O6 及「硬失败」变体零回归）；R1–R9 全部成立且 R1/R8 较 iteration 0 更强；R2 迁移面仍精确封闭；修订未引入新的 ADR/规范冲突或越权决策面，§21 OPEN 项标注诚实。设计可放行实现。

## 11. requiresConflictRecheck

**true** —— (i) 两个生产 seam 的新失败语义（含本轮裁定的 read-throw 归一、F5 宿主非对象守卫、新稳定文案）尚待**实现后**以 implementation 复查核对实际代码与用例；(ii) ws-replication 第二生产包的实际 diff 是否守住 R2/R7 allowlist（G3/G9 绿是机械面，seam 语义面仍需复审）；(iii) R7 机械 gate（G1′ 扩展 + G9 新增）与 G5 capture 五步流程为新增执法面，首次落地属实现后核对项（含 A′-1 的 `@nomicore/*` resolve 载体核对）。
