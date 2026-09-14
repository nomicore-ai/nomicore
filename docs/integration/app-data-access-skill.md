# 应用端数据访问 skill 构建指南

Nomicore 的设计思想是 **schema 与数据严格绑定**：VFSL schema 不只校验形状，它的 JSDoc（数据口径）经投影文本随每次读取交付——`readData` / 窗口读返回 value + schema 投影文本 + truncated 三元组，agent 读到数据的同时就读到了解读它所需的一切（[ADR 0016](../adr/0016-readdata-semantic-schema-projection.md) / [0027](../adr/0027-readdata-projection-text.md)）。本指南回答集成完成之后的问题：**应用端项目的 agent 日常访问数据时，本地应该沉淀什么、坚决不沉淀什么**。

产出物是一个薄的应用端 skill（`AGENTS.md` 数据节或独立 skill 文件）。它在集成收尾时创建一次，此后基本不动。

## 三层信源模型

应用端 agent 的知识只来自三层，每层一个信源，互不复述：

| 层 | 内容 | 信源 | 演进节奏 |
|---|---|---|---|
| 机制 | API 语义、访问形态、纪律、坑 | nomicore skill（[`typed-access.md`](../../.agents/skills/nomicore/typed-access.md) 等） | 随 Nomicore 版本 |
| 形状 + 口径 | 字段类型、业务含义、选窗依据、状态机 | 本项目 `schema.vfsl`（JSDoc 即口径），随读随行投影文本 | 随数据模型 |
| 纪律 + 版本 + 指针 | 写入红线、依赖版本事实、namespace 清单、故障速查 | 应用端 skill（本指南的产出） | 很少变 |

推论：**应用端 skill 里任何一行对数据含义的描述，都是在和运行时投影机制抢信源地位——而且必输**（schema 演进后本地副本即漂移）。判断 skill 内容合法性的唯一测试：这句话描述的是「项目的组织与纪律」，还是「数据是什么」？后者删掉，去 schema 里补。

## 应用端 skill 四件套

### 1. namespace 清单（指针，不是数据描述）

本项目有哪些 namespace、各自的业务定位一句话、schema 与生成物路径。它回答 **where/which**（哪几个篮子、各装哪类东西），永远不回答 **what**（篮子里的东西长什么规则）——后者每次从拉取的投影文本读。

```markdown
## Namespaces

- `tasks` —— 任务域（状态、工作记录、认领）。schema: `domains/tasks/schema.vfsl`；类型: `src/generated/tasks.ts`
- `assets` —— 资产登记。schema: `domains/assets/schema.vfsl`；类型: `src/generated/assets.ts`

探索从 ROOT 面读开始（`readMap([])` 或 `readData([])`），逐层下钻——每层的投影文本自带该层口径，不需要预先学习数据模型。
```

合法：定位一句话、路径、探索起点。非法：字段清单、状态机转移表、"XX 是追加日志所以用 desc"——这些是口径，归 schema JSDoc。

### 2. 写入纪律（几条红线）

- typed adapter 是唯一写入口：所有 mutation 经宿主持有的 typed adapter 构造（`PathAt` / `PathPatchValue` 生成类型约束），禁止手拼路径字符串或绕过 adapter；
- 并发写场景（读-验-写）必须 `guard` CAS（`MUTATION_GUARD_MISMATCH` = 可重试的竞争拒绝：重读旧值、重构造、重提交）；
- 多字段原子更新用批量信封 `{ ops: [...] }`（≤16，全有或全无）；
- schema 改动必须走 codegen 闭环：`generate --check` + projection-aware typecheck，见 [external-project-vfsl-codegen.md](external-project-vfsl-codegen.md)；
- **口径不足时的唯一动作是更新 schema**：改 `schema.vfsl` 的 JSDoc（必要时调整建模）→ codegen → 下一次任何 agent 的读取自动拿到补全的口径。禁止在 skill、wiki、代码注释或会话记忆里补记口径——那会诞生第二信源并必然漂移。

### 3. 版本事实

本项目锁定的 `@nomicore/*` 版本与来源。同名版本号不保证同内容（本地构建与 registry 发布可能同号不同字节）——应用端 agent 开局可见此事实，才不会误装旧版：

```markdown
## 依赖版本

- 来源：npm registry；`@nomicore/namespace-runtime@0.1.12` 等见 `package.json`（lockfile 为准）
- （开发期例外）本地联调 tarball：`/path/to/nomicore/artifacts/local-packages/`，构建于 <日期>，对应 commit <hash>
```

### 4. 故障速查（一行一条，指回上游）

```markdown
## 错误码速查

- `WINDOW_TARGET_ABSENT` —— 路径错或条目已不在；停下重新推导，勿重试、勿期待静默吸收
- `MUTATION_GUARD_MISMATCH` —— CAS 竞争拒绝；重读旧值重构造后重试
- `WINDOW_CARRIER_MISMATCH` —— 换另一个 API（index ↔ key）
- 其余机制细节：加载 nomicore skill 的 typed-access 分支
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

## 反模式清单

- **复制机制文档**——通用访问形态（追加日志取尾 K 条、guard CAS、批量原子、两发读）由 nomicore skill 的 [typed-access](../../.agents/skills/nomicore/typed-access.md) 分支教学；应用端复制一份即制造漂移面。
- **建"访问模式目录"**——"哪个路径适合哪种模式"的判断依据本身是口径（字段是不是时间戳、数组是不是追加日志），归属 schema JSDoc；口径驱动选窗是上游既有设计（[nomicore schema skill](../../.agents/skills/nomicore/schema.md)「a field meant to drive newest / top-K selection is exactly one whose 口径 a future window consumer will rely on」）。
- **复述 schema**——字段清单、类型、例子全部从投影文本读；skill 里只留路径指针。
- **教 API 签名**——`generated.ts` / `.d.ts` 是环境事实源。
- **装一次性集成细节**——Cordis 组装、复制配置做完即沉入代码（[cordis-plugin-hosting.md](cordis-plugin-hosting.md) / [hub-peer-deployment.md](hub-peer-deployment.md) 职责），不占常驻 skill 负载。

## 最小模板

```markdown
# <项目名> 数据访问

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

## 错误码速查
- <稳定码> —— <一句处置>；机制细节加载 nomicore skill
```
