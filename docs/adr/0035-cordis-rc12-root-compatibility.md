# ADR 0035：Cordis 4.0.0-rc.12 的双形态 Root 兼容

日期：2026-11-14

状态：提议（tracking issue #468；目标发布为 Nomicore `0.5.0`；生产代码迁移尚未实施）

## 背景

Nomicore 的 Persistence scheduler 与 Hub/Peer replication timer 当前都读取 `ctx.root`，以便把 adapter/连接生命周期所需的调度绑定到 Host root Context，而不是正在卸载的下游 Fiber。

Cordis 的不同工件存在两种互斥的 Root 公共面：

| 工件 / 代码锚点 | Root Context 公共面 |
| --- | --- |
| npm `@deepseek-ai/cordis@4.0.1` 与 `4.1.0` | `ctx.root`；没有 `Context.root` static symbol |
| DSH commit [`1511a6ed442c207919142a4b0e6c4916f96d2c3b`](https://github.com/deepseek-ai/deepseek-harness/commit/1511a6ed442c207919142a4b0e6c4916f96d2c3b) 引入的 Cordis `4.0.0-rc.12` 行为 | `ctx[Context.root]`，底层公开 global symbol 为 `Symbol.for('cordis.root')`；不再有 `ctx.root` |

DSH 的 vendored package 在上述 commit 仍标为 `@deepseek-ai/cordis@4.1.0`，Timer 为 `1.2.0`，Cosmokit 为 `1.9.0`。因此 package version 不能独立证明 Root API 形态；兼容目标必须绑定实际 commit 和源码/构建产物。

DSH `dsh-v0.2.2-rc.3`（`38a6a5c965`）仍使用 legacy `ctx.root`，不属于本 ADR 的 symbol Root 目标。此前把后续 checkout 当作 rc.3 的审计证据已撤回，不作为本 ADR 的 POC 或验收依据。

### Nomicore 影响面

- [`@nomicore/persistence` 的 Host scheduler](../../packages/persistence/src/service.ts)在 root Context 上武装 flush/retry timer，保障 Registry 已接纳写在 dependent 卸载期间仍能完成 dirty notification；
- [`@nomicore/ws-replication` 的 Host timer adapter](../../packages/ws-replication/src/plugin.ts)在 root Context 上管理连接、重试、ACK 与活性 timer；
- 现行测试还有若干直接读取 `ctx.root` 的 Host fixture，必须随生产适配一起覆盖两种形态；
- 其余 Cordis 使用面——公开 plugin factory、静态 `inject`、有序 `ctx.effect` / `ctx.provide`、受控直接 `apply()` 与冻结服务 getter——经审查不需要因 rc.12 另行迁移。

## 决策

### 1. Nomicore 自持双形态兼容，不要求上游改名或对齐

Nomicore 不依赖 DSH 调整 vendored 内容、版本号或发布节奏。同一 Nomicore 发布版本通过包内私有兼容层支持 legacy 与 symbol 两种 Root 形态。

已验证支持基线在验收完成前不得预先扩大。目标矩阵固定为：

1. Cordis `4.0.1` + Timer `1.1.3`；
2. npm Cordis `4.1.0` + Timer `1.2.0`；
3. DSH commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b` 的 vendored Cordis `4.1.0`（rc.12 行为）+ Timer `1.2.0` + Cosmokit `1.9.0`。

依赖 range 只表示包管理器允许解析，不等于支持承诺。其他 Cordis/Timer 版本和后续 DSH master 在通过对应验收前均为未验证。

### 2. Root 解析采用 symbol 优先、legacy 属性兜底

两个受影响包各自保留一个包内私有 Root 解析缝，不新增公共包、公共 export 或跨领域依赖。决策形态为：

```ts
const root = (
  Reflect.get(ctx, Symbol.for('cordis.root'))
  ?? Reflect.get(ctx, 'root')
) as Context | undefined
```

只有 symbol 通道缺席时才读取 legacy `root`。解析结果必须提供所需 `timeout`；缺席或形状不符时响亮失败，不 fallback 到全局 `setTimeout` 或其他 ambient timer。

`Reflect.get` 只用于让同一份 Host adapter 源码在互斥的 Cordis 类型面上构建。兼容 cast 不得扩散到 Registry、Persistence 核心、Replication 状态机或业务 API。

生产代码和现行 Host fixtures 中的直接 `ctx.root` 读取统一迁移到该解析缝。历史 `artifacts/` 不改写，也不作为现行兼容证据。

### 3. 保持既有调度所有权与停机语义

本 ADR 补充 ADR 0006、0009、0012 的 Cordis API 兼容方式，不改变其生命周期决策：

- Persistence scheduler 和 Replication timer 仍绑定 Host root Context；
- 业务消费者与 replication 先停止/drain，Registry 随后 shutdown，Persistence 再 drain/dispose，Timer 最后释放；
- replication plugin 不销毁上游 Registry、Persistence、Clock 或 Timer；
- 现有有序 async effect、service revoke、dependent Fiber join、watchdog 与有界 drain 保留；
- 直接 `apply()` 的 profile 仍显式执行 adapter dispose 后再释放 root Context。

不得因为 rc.12 的 provider/dependent 机制而假定 Timer 自动最后释放。Persistence 对 Clock/Timer 使用运行时断言而非静态 `inject`，Host 的显式生命周期职责不变。

### 4. 依赖与公共契约不变

- 保持 Cordis `^4.0.1`、Timer `^1.1.3` 的现有依赖范围，不为取得 symbol API 提升 npm 最低版本；
- 不在本阶段改变 dependency / peerDependency 归属；未来如需变更，另立 ADR；
- 不改变 Namespace、Registry、Replication、Persistence、Instance、Clock 的公共 API、服务名、schema、wire protocol 或持久化布局；
- 不采用 volatile config、`internal/config` / `internal/update` / `internal/commit` 或其他无关 Cordis 新能力；
- 不读取 Cordis 私有 Fiber store 或其他未公开内部面，只使用公开 global symbol 与旧公共属性。

### 5. 验收必须绑定精确工件与 Root 通道

每个目标基线分别执行全仓 typecheck 和同一组外部行为测试；一个基线的绿色结果不得抵销另一个基线失败。

DSH rc.12 目标基线的测试夹具必须：

1. 固定到 commit `1511a6ed442c207919142a4b0e6c4916f96d2c3b`；
2. 从该 revision 的 vendored 源码构建，或校验既有构建产物确实对应该 revision；
3. 在测试开始时断言实际模块解析路径；
4. 用运行时探针证明该基线命中 symbol Root 通道，npm 基线命中 legacy 通道；
5. 在发生依赖解析回退、同名包替换、版本元数据错配或 Root 通道错配时失败。

行为测试至少覆盖 Memory/File Persistence 的真实 Timer flush/retry/drain/dispose、Registry Cordis 启动与 shutdown、Hub/Peer/SessionHost 启停和 timer 清理、冻结服务 guard-Proxy、DSH profile 以及第三方组合根。生产包构建与发布检查保持既有门禁。

本 ADR 不使用此前错误标记为 rc.3 的 POC 作为 rc.12 验收证据；目标基线必须重新执行并留存结果。

### 6. 明确排除 Host 侧实施

Nomicore 本阶段不负责真实 MABF/DSH Host 的部署验收，不修改、不移除 MABF 的本地 patchedDependencies，也不宣称 Host 可以据此删除 patch。

Host owner 可以另行决定是否用完成本兼容迁移的 Nomicore 发布替代本地 patch；该决策、迁移窗口与部署验证不属于本 ADR。

legacy fallback 不设自动删除时间。只有未来支持策略正式退出旧 npm Host、并由新的 ADR 批准收窄时，才能删除双形态兼容层。

## 被否决方案

- **继续以 DSH rc.3 为 symbol Root 目标**：与 tag 工件事实不符，已否决并撤回。
- **只提升依赖到 `^4.1.0` / Timer `^1.2.0`**：版本号不能区分 legacy 与 rc.12 工件，也不会自动迁移 Root 读取。
- **直接硬切 `ctx[Context.root]`**：会切断当前 npm 发布面和既有 standalone Host。
- **放弃 Host root timer，改用当前 plugin Context**：会把 adapter/连接 drain 的调度绑回正在卸载的 Fiber，违反既有生命周期契约。
- **新建公共 Cordis compat 包或把 Root helper 放进 Clock/Instance**：为一个窄 API 差异扩大公共契约和依赖图。
- **把 MABF 本地 patch 当作 Nomicore 主仓兼容完成**：Host-specific patch 不能替代主仓公共工件与测试证据，且其移除不在本阶段范围内。

## 后果

- Nomicore 主仓可在不改变 Host 装配方式的前提下覆盖 legacy 与 rc.12 symbol 两种 Root 形态。
- 两个 Host adapter 增加一个需要长期维护的私有兼容缝；其删除需要新的支持策略 ADR。
- CI 必须保存精确 revision、工件解析和 Root 通道证据，不能再以版本号或 checkout 当前状态替代目标工件。
- 本 ADR 不承诺真实 MABF/DSH 部署结果，也不要求 Host 移除本地 patch。
