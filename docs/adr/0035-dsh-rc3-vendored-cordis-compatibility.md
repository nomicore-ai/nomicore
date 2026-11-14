# ADR 0035：DSH rc.3 vendored Cordis 的双形态 Root 兼容

日期：2026-11-14

状态：已接受（Owner 于 2026-11-14 确认；目标发布为 Nomicore `0.5.0`，生产代码迁移尚未合入）

## 背景

DSH `dsh-v0.2.2-rc.3` 将 vendored `@deepseek-ai/cordis` 标为 `4.1.0`，并将 `@deepseek-ai/cordis-plugin-timer` 标为 `1.2.0`。Nomicore 当前清单范围为 Cordis `^4.0.1`、Timer `^1.1.3`，lockfile 固定在 Cordis `4.0.1`、Timer `1.1.3`。范围已经容纳上述新版本，因此“是否需要对应更新”不能由 semver range 单独回答。

实际工件审计发现了一个同名不同面的兼容陷阱：

| 工件 | Root Context 公共面 |
| --- | --- |
| npm `@deepseek-ai/cordis@4.0.1` / `4.1.0` | `ctx.root`，没有 `Context.root` static symbol |
| DSH `dsh-v0.2.2-rc.3` 的 vendored Cordis `4.1.0` | `ctx[Context.root]`，即 `Symbol.for('cordis.root')`；不再有 `ctx.root` |

DSH 的 [Cordis Root 与 intercept metadata 迁移指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.3/docs/upgrade-guide/v0.2.2-rc.2/cordis-root-and-intercept-metadata/guide.zh.md)记录了该破坏面；指南目录名属于被破坏的旧 DSH 版本，而 rc.3 已包含这项变化。兼容验收必须以 rc.3 tag 的实际 vendored 源码和构建产物为准，不能以 npm 包上的同一个 `4.1.0` 版本号代替。

Nomicore 生产代码有两处 Root 读取：

- [`@nomicore/persistence` 的 scheduler](../../packages/persistence/src/service.ts)用 Host root Context 武装 flush/retry timer，使 Persistence Fiber 卸载期间，Registry 已接纳的写仍能完成 dirty notification；
- [`@nomicore/ws-replication` 的 timer adapter](../../packages/ws-replication/src/plugin.ts)用 Host root Context 管理 replication timer，使连接 drain 不依赖正在卸载的下游 Fiber。

对 rc.3 vendored 工件直接执行 root `pnpm typecheck` 可稳定得到 `TS2576: Property 'root' does not exist on type 'Context'`。仅改用 `ctx[Context.root]` 又会反向切断 npm `4.0.1` / `4.1.0`：这些已发布工件没有 `Context.root` static member。因而这不是一次普通的依赖下限提升。

## 决策

### 1. 双形态兼容由 Nomicore 长期自持

Nomicore 不能影响 DSH 的 vendored 内容或 npm 发布节奏，因此不把“推动上游对齐同名工件”作为前提、阻塞项或退出义务。双形态 Root 兼容是 Nomicore 自己承担的 Host 兼容层，而不是等待 DSH 修复期间的临时补丁。

同一 Nomicore 发布版本的**已验证支持基线**仅限：

- Cordis `4.0.1` + Timer `1.1.3`；
- npm Cordis `4.1.0` + Timer `1.2.0`；
- DSH `0.2.2-rc.3` 实际携带的 vendored Cordis `4.1.0` + Timer `1.2.0`。

现有 `^4.0.1` / `^1.1.3` 范围保持不变，但依赖范围只表示包管理器允许解析，不扩大上述支持承诺。其他 Cordis `4.0.x` 或未来版本在完成对应验收前均为“未验证”，不因 semver range 自动成为受支持基线。本次不把 Cordis 最低版本提升到 npm `4.1.0`，也不为了取得新 Root API 而制造不存在的 npm 版本要求；lockfile 是否做常规版本刷新与兼容修复分离，不作为修复正确性的证据。

### 2. Root 读取采用 symbol 优先、legacy 属性兜底

两个受影响包各自保留一个**包内私有** Root 解析缝，不新增公共包、公共 export 或跨领域依赖。解析顺序固定为：

```ts
const root = (
  Reflect.get(ctx, Symbol.for('cordis.root'))
  ?? Reflect.get(ctx, 'root')
) as Context | undefined
```

只有 symbol 通道缺席时才读取 legacy `root`，因此 rc.3 不会触达已移除的属性。解析结果必须提供所需 `timeout`；缺失时沿用响亮失败，不 fallback 到全局 `setTimeout` 或宿主 ambient timer。

这里使用 `Reflect.get` 是为了让同一份源码能在两套互斥的 Cordis 类型面上构建，不是放开业务对象的动态属性访问。兼容 cast 只存在于上述 Host adapter 缝；Registry、Replication 状态机和 Persistence 核心不感知 Root 形态差异。

生产代码与现行测试中的 `ctx.root` 都迁移到该解析缝。历史 `artifacts/` 是既往验证证据，不回写、不冒充现行测试面。

### 3. 保持既有生命周期与资源所有权

本 ADR 补充 ADR 0006、0009、0012 的 Cordis API 兼容方式，不改变其决策：

- Persistence scheduler 与 replication timer 仍绑定 Host root Context；
- Registry 先 shutdown/drain，Persistence 随后 drain/dispose，Timer 最后释放；
- replication plugin 只停止自己的 listener/dialer/controller/connections/channels/service，不销毁上游 Registry、Persistence、Clock 或 Timer；
- 现有有序 async effect、service revoke 与 dependent Fiber join 保留。

Cordis 4.1 新增的 provider 等待 dependent unload 机制视为底层语义强化，不作为删除 Nomicore 有序 disposer 的理由。不得借本次迁移引入 volatile config、`internal/config` / `internal/update` / `internal/commit` 或其他新配置面。

独立静态审查未发现 Root 之外的其他必须迁移点：`ctx.effect` / `ctx.provide` / `ctx.plugin` / 静态 `inject`、受控直接 `apply()`、callback 形式 `timeout()` 和 ADR 0023 的冻结服务 getter 构造纪律均保持。Replication → Registry → Persistence 的依赖与拆卸方向是单向图；provider 等 dependent、撤服务与显式逆序 shutdown 之间没有反向等待边，因此不构成固有等待环。若某个 stop/shutdown 永不 settle，等待仍会向上游传播，Host 的 watchdog 与有界 drain 预算不能取消。

尤其不能由新 dependents 机制推导“Timer 会自动最后释放”：Persistence 对 Clock/Timer 使用运行时依赖断言，没有声明静态 `inject: ['clock', 'timer']`，因此不会自动建立 Timer → Persistence 的依赖边。Host 仍须显式保证 Timer 最后拆卸；直接 `apply()` 的 profile 仍须自行维持 `persistence.dispose()` 后再释放 root Context 的顺序。

### 4. 以实际工件矩阵验收，而非只看版本号

兼容修复合入前至少执行：

1. **旧基线**：Cordis `4.0.1` + Timer `1.1.3`；
2. **npm 新基线**：npm Cordis `4.1.0` + Timer `1.2.0`；
3. **DSH 目标基线**：`dsh-v0.2.2-rc.3` 的 vendored Cordis / Timer，记录实际模块解析路径。

每一基线都运行 root `pnpm typecheck`，以及 Persistence real-Timer flush/dispose、Registry Cordis 启动/shutdown/dependent drain、Hub/Peer plugin 启停与 timer 清理、冻结服务 guard-Proxy、DSH persistence profile 测试。DSH 目标基线还需跑真实 `nomicore-host` 装配、listener bind 失败回滚和完整 root dispose 后再取得同一 File Persistence root 的恢复测试。

任一基线失败都不能用另一基线的绿色结果抵销。未来新增 DSH vendored 兼容目标时，同样记录 DSH tag、工件路径和解析结果；不允许只凭 package version 宣称兼容。

CI 的 DSH 目标基线必须固定到明确 tag 或 commit，从该 revision 的 vendored 源码构建工件，或校验所用既有构建产物确实对应该 revision。测试开始时必须断言实际模块解析路径，并以运行时探针确认当前工件的 Root 形态与该基线的预期一致：npm 基线命中 legacy 属性通道，DSH rc.3 基线命中 symbol 通道。若发生依赖解析回退、工件版本错配或 Root 通道错配，测试必须失败，不得以另一个同名包的绿色结果通过验收。

### 本次 POC 证据（未合入生产代码）

在隔离 worktree 中实现上述双形态 Root 读取后，三个基线分别通过了 root `pnpm typecheck` 和同一组 14 个套件、178 项测试：

- Cordis `4.0.1` + Timer `1.1.3`；
- npm Cordis `4.1.0` + Timer `1.2.0`；
- DSH `dsh-v0.2.2-rc.3` vendored Cordis `4.1.0` + Timer `1.2.0`，模块解析路径已确认指向该 tag 的工件副本。

套件覆盖 Memory/File Persistence、真实 Timer、Registry 有序卸载、Hub/Peer plugin、SessionHost 免 listen 模式、guard-Proxy、DSH profile 与第三方组合根。POC 证明双形态方案可行，但不替代上述真实 DSH `nomicore-host` 最终验收，也不表示迁移已经合入。

### 5. 发布、依赖边界与兼容层退出

- 目标发布为 **Nomicore `0.5.0`**。实施由 tracking issue #462 跟踪，实施 PR 必须关联对应 issue；ADR 接受不等于生产迁移已经完成。
- 本 ADR 不改变 Cordis / Timer 在 Nomicore 包中的 dependency 或 peerDependency 归属。发布前必须使用真实打包产物完成 Host 安装图与运行时验收，防止源码 worktree 掩盖重复实例、依赖提升或 peer 解析问题。
- 若未来要把 Cordis / Timer 改为 peerDependency，或改变 Host 提供这些包的职责，必须另立 ADR 评估公共包安装契约，不属于本次 Root 兼容实施。
- legacy fallback 不设自动删除时间，也不以 DSH 发生变化为前提。只有支持策略正式退出旧 npm Host、且新的 ADR 明确批准收窄时，才能删除双形态兼容层。

## 被否决方案

- **只把清单改成 `^4.1.0` / Timer `^1.2.0`**：范围变化不会迁移 `ctx.root`，且 npm 与 DSH 的同名 `4.1.0` 面不同，会产生虚假兼容结论。
- **直接硬切 `ctx[Context.root]` 并要求所有宿主跟随**：改动最小，但当前 npm 发布面没有该 static member，会破坏 standalone 与既有 npm Host。
- **放弃 Host root timer，改用当前 plugin Context**：会把 adapter/连接 drain 的调度绑回正在卸载的 Fiber，违反 ADR 0006/0009 已接纳的排空窗口。
- **新建公共 Cordis compat 包或把 Root helper 放进 Clock/Instance**：为一个窄 API 差异增加公共模块和依赖方向，扩大契约面；两个 Host adapter 内的私有缝足够。
- **读取 Cordis 内部 `symbols`、Fiber store 或原始 unwrapped Timer**：把兼容层绑到未承诺的内部实现；本决策只消费 DSH 迁移指南公开的 global root symbol 与旧公共属性。

## 后果

- Nomicore 公共 Namespace/Registry/Replication API、schema、wire protocol 和持久化布局均不变。
- 两个 Host adapter 各增加一个长期维护的双形态读取缝；只有新的 ADR 正式收窄 Host 支持策略时才删除 legacy fallback，不假设 DSH 或 npm 工件将来会对齐。
- CI/发布验证必须保留实际 DSH vendored 工件路径；npm 类型检查与测试不能替代 DSH Host 验收。
- 本 ADR 不要求修改 DSH 的插件装配顺序，也不要求 Nomicore 消费 Cordis 4.1 的新配置 API。
