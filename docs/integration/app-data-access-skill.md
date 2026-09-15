# 应用端数据访问 skill 构建指南

Nomicore 的设计思想是 **schema 与数据严格绑定**：VFSL schema 不只校验形状，它的 JSDoc（数据口径）经投影文本随每次读取交付——`readData` / 窗口读返回 value + schema 投影文本 + truncated 三元组，agent 读到数据的同时就读到了解读它所需的一切（[ADR 0016](../adr/0016-readdata-semantic-schema-projection.md) / [0027](../adr/0027-readdata-projection-text.md)）。本指南回答集成完成之后的问题：**应用端项目的 agent 日常访问数据时，本地应该沉淀什么、坚决不沉淀什么**。

产出物是一个薄的应用端 skill（`AGENTS.md` 数据节或独立 skill 文件）。它在集成收尾时创建一次，此后基本不动。

## 三层信源模型

应用端 agent 的知识只来自三层，每层一个信源，互不复述：

| 层 | 内容 | 信源 | 演进节奏 |
|---|---|---|---|
| 机制 | API 语义、访问形态、纪律、坑 | nomicore skill——GitHub 仓库 [`.agents/skills/nomicore/`](https://github.com/welltop-jim-wang/nomicore/tree/main/.agents/skills/nomicore) 随时取最新；应用端 skill 内联**基本面速查**（见五件套第 1 件） | 随 Nomicore 版本 |
| 形状 + 口径 | 字段类型、业务含义、选窗依据、状态机 | 本项目 `schema.vfsl`（JSDoc 即口径），随读随行投影文本 | 随数据模型 |
| 纪律 + 版本 + 指针 | 写入红线、依赖版本事实、namespace 清单、故障速查 | 应用端 skill（本指南的产出） | 很少变 |

推论：**应用端 skill 里任何一行对数据含义的描述，都是在和运行时投影机制抢信源地位——而且必输**（schema 演进后本地副本即漂移）。判断 skill 内容合法性的唯一测试：这句话描述的是「项目的组织与纪律」，还是「数据是什么」？后者删掉，去 schema 里补。

## 应用端 skill 五件套

### 1. API 基本面速查（内联，版本锚定）

基本能力必须开箱可及——不假设 agent 会去上游仓库翻文档。nomicore skill 不随 npm 包分发，所以应用端 skill 内联一份**基本面调用形态**（获取 schema / 读 / 写的最小示例），并锚定版本：

```markdown
## API 基本面（对应 @nomicore/*@<锁定版本>；升级依赖时 review 本节）

获取 schema（理解数据的第一步，永远先于访问）:
  lease.getSchema()          // VFSL 全文（SchemaEnvelope）
  lease.getActiveSchema()    // active schema 六字段身份（generation/updatedAt）
  // 运行时口径：每次 readData 的 schema 键即该路径的投影文本——读数据的同时读口径

读:
  lease.readData(path)                       // 完整投影，四键 { ok, value, schema, truncated }
  lease.readData(path, { depth, maxChildrenPerNode })   // 预算读（depth≥0，0 = 骨架）
  lease.readArray(path, { n, orderBy, where? })   // 序列容器窗口（index 基 = 位置序）
  lease.readMap(path, { n, orderBy, where? })     // 键容器窗口（key/field 基 = 值序）
  // where 过滤窗口（ADR 0029）：[{ field, equals }] 标量等值合取，管线 where → orderBy → n；
  //   匹配总数不承诺、✂ 段不装配，truncated = 装满判定（kept===n 可能还有 / kept<n 确定没有更多，
  //   要计数给大 n）；脏值（字段缺席/非标量/不可下钻）安静不匹配。深水区见 nomicore skill

写（一律经 typed adapter 构造，生成类型约束路径与值）:
  lease.mutateData({ op: 'set', path, value })                    // 单操作
  lease.mutateData({ op: 'set', ..., guard: { path, equals } })   // CAS（并发安全）
  lease.mutateData({ ops: [ ... ] })                              // 批量原子（≤16，全有或全无）

订阅（变更信号——不含值，定位符 {path, key}；建立失败同步 throw）:
  lease.watchMap(path, listener[, { where }])   // 键容器订阅 → { unsubscribe() }
  // where 谓词: { field, equals } | { field, in }（标量；缺失/null 恒不匹配；in 空数组拒绝）
  // 通知三 kind: data（按 key 拉终态自辨）/ invalidate-all（全量重拉）/ watch-end（重建订阅）
  // origin: 'local' | 'replication'——self-echo 抑制在消费方；消费协议模板见 nomicore skill
```

内联的合法性来自两条：基本面是**稳定的公共 API 契约**（比机制细节稳定得多，漂移风险低）；且**版本锚定**（本节标明对应版本，升级依赖时必 review）。机制深水区（✂ 段解读、边界行为、完整纪律）不内联——见第 5 件的 GitHub 引用。

### 2. namespace 清单（指针，不是数据描述）

本项目有哪些 namespace、各自的业务定位一句话、schema 与生成物路径。它回答 **where/which**（哪几个篮子、各装哪类东西），永远不回答 **what**（篮子里的东西长什么规则）——后者每次从拉取的投影文本读。

```markdown
## Namespaces

- `tasks` —— 任务域（状态、工作记录、认领）。schema: `domains/tasks/schema.vfsl`；类型: `src/generated/tasks.ts`
- `assets` —— 资产登记。schema: `domains/assets/schema.vfsl`；类型: `src/generated/assets.ts`

探索从 ROOT 面读开始（`readMap([])` 或 `readData([])`），逐层下钻——每层的投影文本自带该层口径，不需要预先学习数据模型。
```

合法：定位一句话、路径、探索起点。非法：字段清单、状态机转移表、"XX 是追加日志所以用 desc"——这些是口径，归 schema JSDoc。

### 3. 写入纪律（几条红线）

- typed adapter 是唯一写入口：所有 mutation 经宿主持有的 typed adapter 构造（`PathAt` / `PathPatchValue` 生成类型约束），禁止手拼路径字符串或绕过 adapter；
- 并发写场景（读-验-写）必须 `guard` CAS（`MUTATION_GUARD_MISMATCH` = 可重试的竞争拒绝：重读旧值、重构造、重提交）；
- 多字段原子更新用批量信封 `{ ops: [...] }`（≤16，全有或全无）；
- schema 改动必须走 codegen 闭环：`generate --check` + projection-aware typecheck，见 [external-project-vfsl-codegen.md](external-project-vfsl-codegen.md)；
- **口径不足时的唯一动作是更新 schema**：改 `schema.vfsl` 的 JSDoc（必要时调整建模）→ codegen → 下一次任何 agent 的读取自动拿到补全的口径。禁止在 skill、wiki、代码注释或会话记忆里补记口径——那会诞生第二信源并必然漂移。

### 4. 版本事实

本项目锁定的 `@nomicore/*` 版本与来源。同名版本号不保证同内容（本地构建与 registry 发布可能同号不同字节）——应用端 agent 开局可见此事实，才不会误装旧版：

```markdown
## 依赖版本

- 来源：npm registry；`@nomicore/namespace-runtime@0.1.12` 等见 `package.json`（lockfile 为准）
- （开发期例外）本地联调 tarball：`/path/to/nomicore/artifacts/local-packages/`，构建于 <日期>，对应 commit <hash>
```

### 5. 机制引用与故障速查

机制深水区（✂ 段解读、预算/窗口完整纪律、边界行为、mutation policy）**不内联**——指向 GitHub 的 nomicore 仓库，agent 随时获取最新：

```markdown
## 机制参考（随时取最新）

- nomicore skill 全文: https://github.com/welltop-jim-wang/nomicore/tree/main/.agents/skills/nomicore
  （typed-access = 读/写/窗口/订阅——含 watchMap 消费协议模板；schema = 建模与口径；cordis-host / replication = 组装与复制）
- 应用端 skill 构建指南: docs/integration/app-data-access-skill.md（同仓库）

注意版本错位：GitHub main 的 skill 反映最新机制语义；本项目锁定的 npm 版本较旧时，
以**锁定版本的运行时行为**为准，升级依赖后再对齐 skill。

## 错误码速查

- `WINDOW_TARGET_ABSENT` —— 路径错或条目已不在；停下重新推导，勿重试、勿期待静默吸收
- `MUTATION_GUARD_MISMATCH` —— CAS 竞争拒绝；重读旧值重构造后重试
- `WINDOW_CARRIER_MISMATCH` —— 换另一个 API（index ↔ key）
- `WINDOW_OPTIONS_INVALID` —— 选项词形非法（n:0 / orderBy 越词表 / where 形状非法——非数组、未知键、空或超限、非标量 equals）；修 options，勿重试
- `WATCH_MAP_CARRIER_MISMATCH` —— 订阅目标非键容器（偏离 schema / 数组载体）；修路径，数组走窗口读
- `WATCH_MAP_OPTIONS_INVALID` —— 谓词词形非法（field 不存在 / 非标量域 / `in` 空数组）；修 options，勿重试
- `WATCH_MAP_SCHEMA_UNAVAILABLE` —— 无 active schema，watchMap 整体不可用（含无谓词形态）；先装 schema
```

## 澄清闭环

```text
agent 读到 value + 投影文本
  → 口径不够用（字段含义模糊 / 缺选窗依据 / 缺状态机说明）
  → 更新 schema.vfsl 的 JSDoc（必要时调整建模）
  → generate --check + typecheck
  → 下一次任何 agent 的 readData，补全的口径随投影文本自动到达
```

对比错误路径："口径不清楚 → 问人 / 查 wiki / 在 skill 里补一段" → 第二信源诞生 → 漂移 → 上游或 schema 修复后本地仍在教旧事实。

## 工具面暴露的边界（`nomicore_read` 等 L2 通用只读工具）

有的消费方宿主把 Nomicore 读查询进一步包装成通用只读工具（如 `nomicore_read`，L2 层）暴露给自己的 agent。这类工具本体属其宿主仓库：本仓的责任到文档与 skill 口径为止——`readData` / 窗口读 / 过滤窗口（`where`，[ADR 0029](../adr/0029-filtered-window-read.md)）的读法、结算形状与失败码以上游文档（[ADR 0027](../adr/0027-readdata-projection-text.md) / [0028](../adr/0028-window-read.md) / 0029 与 nomicore skill）为准绳；工具面暴露（注册、参数与截断预算形状）属消费面票，由宿主仓库自行决定。

## 反模式清单

- **复制机制深水区**——机制细节分两级：基本面调用形态（获取 schema / 读 / 写）可内联且必须版本锚定（五件套第 1 件）；深水区（✂ 段解读、预算/窗口完整纪律、边界行为、mutation policy）指向 [GitHub 的 nomicore skill](https://github.com/welltop-jim-wang/nomicore/tree/main/.agents/skills/nomicore) 随时取最新，复制一份即制造漂移面。
- **建"访问模式目录"**——"哪个路径适合哪种模式"的判断依据本身是口径（字段是不是时间戳、数组是不是追加日志），归属 schema JSDoc；口径驱动选窗是上游既有设计（[nomicore schema skill](../../.agents/skills/nomicore/schema.md)「a field meant to drive newest / top-K selection is exactly one whose 口径 a future window consumer will rely on」）。
- **复述 schema**——字段清单、类型、例子全部从投影文本读；skill 里只留路径指针。
- **教 API 签名细节**——`generated.ts` / `.d.ts` 是环境事实源；基本面速查给的是调用**形态**，不是签名抄写。
- **装一次性集成细节**——Cordis 组装、复制配置做完即沉入代码（[cordis-plugin-hosting.md](cordis-plugin-hosting.md) / [hub-peer-deployment.md](hub-peer-deployment.md) 职责），不占常驻 skill 负载。

## 最小模板

```markdown
# <项目名> 数据访问

## API 基本面（对应 @nomicore/*@<锁定版本>；升级依赖时 review 本节）
获取 schema: lease.getSchema() / getActiveSchema()；运行时口径 = readData 的 schema 键
读: readData(path[, budget]) / readArray(path, {n, orderBy, where?}) / readMap(path, {n, orderBy, where?})
写: mutateData(<typed adapter 构造的信封>；guard CAS / { ops } 批量原子)
订阅: watchMap(path, listener[, {where}]) → {unsubscribe}；通知=不含值的信号，消费协议见 nomicore skill

## Namespaces
- `<id>` —— <一句话定位>。schema: <路径>；类型: <路径>
（探索从 ROOT 面读开始，逐层下钻，口径随投影文本到达）

## 写入纪律
- mutation 一律经 typed adapter 构造（src/adapters/…）；禁止手拼路径
- 读-验-写必须 guard CAS；多字段原子更新用 { ops }
- schema 改动走 generate --check + typecheck
- 口径不足 → 更新 schema JSDoc 并 codegen；禁止在本文件/wiki/注释补记口径

## 依赖版本
- <来源与版本事实；开发期例外写 tarball 路径与构建日期>

## 机制参考（随时取最新）
- https://github.com/welltop-jim-wang/nomicore/tree/main/.agents/skills/nomicore
- 版本错位时以锁定版本的运行时行为为准

## 错误码速查
- <稳定码> —— <一句处置>
```
