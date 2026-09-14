# MABF Task Brief

Repository: welltop-jim-wang/nomicore
Issue: #393
Title: FileDiagnosticLog 在 registry 接缝静默半工作：自然组合零记录（segments 恒空根因）
State: open
Issue updated at: 2026-09-14T13:12:56Z

## Issue body

## 现象（bug 报告摘要）

`@nomicore/namespace-diagnostic-log` 在外部 Host（DSH 的 nomicore-host / mabf-runner，Hub 与 Peer 两端）只产出 stream `manifest.json` 与 `current.json`，`segments/` 恒空——尽管 namespace 持续有 root-mutation 与 replication apply。无任何错误、无任何健康事件。（bugreport-ndcl-empty-segments，2026-09-14 tarball 批次，namespace-diagnostic-log@0.1.8）

出错接线（DSH `nomicore-host/src/index.ts:173-185`、`mabf-runner/src/nomicore-runtime.ts:75-85`）：

```ts
const log = createFileDiagnosticLog({ rootDir, namespaceId, ... })
createNamespaceRegistryPlugin(config, { diagnosticLog: log })
```

## 定性（维护者裁决：产品缺陷，非配置错误）

自然组合必须直接工作；不能正常工作即是 bug：

- 两个面都是 nomicore 公共导出（`createFileDiagnosticLog` 注释自述「生产构造器（§1.2 公共面）」；`diagnosticLog` 是 registry 的诊断消费点），理应直接组合。实际后果：只记 create 尝试，runtime 级 emission（root-mutation / replication-apply）静默消失。
- `FileDiagnosticLog` 已携带全部所需信息（`namespaceId` + `emitter`，均为 public 成员），缺的只是让 registry 认出它是该 namespace 的 per-ns 日志。
- registry 的 legacy 回落（无 `runtimeEmitterFor` → #150 逐字节行为，`create-diagnostic.ts:417-463`，`resolveRuntimeDiag` 恒 undefined → Runtime 无 `diagnosticEmitter`）保存的是**历史过渡态**（#150 时代 registry 仅有 create 诊断；runtime 级诊断是 #149/#155 之后才有），不是「裸 emitter 只记 create」的产品承诺。observability 系统以无错误/无警告/零输出方式失效 = 最坏失效模式。
- 佐证：legacy 形状的合法生产消费者为零（仓内 app 用完整 manager binding；仓内契约测试全部以 `{emitter: log.emitter }` 字面量经 testing seam 注入、绕过 plugin 类型面——已核实仓内无任何测试直传 raw log 对象）。

差分验证（诊断会话，三臂 harness，重跑：`NODE_OPTIONS=--conditions=nomicore-source pnpm vitest run packages/namespace-registry/test/zz-ndcl-empty-segments-repro.test.ts`）：

| 臂 | 操作 | 结果 |
|---|---|---|
| A | `emitter.emit(root-mutation)` 直发 | ✅ 落盘——排除适配器静默失败/缓冲假设 |
| B | 自然组合复刻（raw log → registry → open+mutate） | ❌ 0 条记录——精确复现症状 |
| C | binding 换 `{emitter, initStream, runtimeEmitterFor}` | ✅ root-mutation 落盘 |

## What to build

**P0（主修复）——`FileDiagnosticLog` 自绑定**
- `FileDiagnosticLog` 增加成员 `runtimeEmitterFor(namespaceId: string): NamespaceDiagnosticChangeEmitter | undefined`，实现 = `ns === this.namespaceId ? emitter : undefined`；不加 `initStream`（泵路径对缺席成员已有 no-op 语义；stream 在构造期已 eager 建立，resume 路径照常）。
- 效果：registry 装配发现 `runtimeEmitterFor` 在场 → 生产泵路径（数据键控归因，#155「归因键是数据不是时间」纪律合规）→ 该 ns 的 mutation / replication apply 经泵 drain 落 segments；其他 ns 解析 undefined → 泵内静默丢弃（单 ns 日志的诚实语义，杜绝跨 namespace 写错流）。
- **DSH 两个部署零代码改动**：下个 tarball 批次 + 重启即恢复日志。
- 设计细节留 PR 评审定案：泵路径下无归属公共入口拒绝（namespaceId 生成前的 create 拒绝）经共享 emitter 落该流——单 ns 部署可解释，与 yjs-server manager「unattributed 恒丢弃」语义不一致；倾向接受落盘，实现时显式定案并写入契约测试。

**P1——`@nomicore/yjs-server` 导出多 namespace manager（保留，降级为多 ns Host 的正路）**
- `apps/yjs-server/src/diagnostics.ts` 的 `createHostDiagnosticsManager` 泛化签名后从 `index.ts` 导出（摆脱 app 本地类型 `DiagnosticsConfig` 的 `enabled` 标志与 `EventSink` 的 stdout 语义，sink 泛化为 `onEvent?: (e) => void`、钟泛化为 `now: () => number`）；app 内部消费同一导出，全仓该逻辑仅一份。

**P2——skill 修订：`.agents/skills/nomicore/` 描述正确配置方式**
- `cordis-host.md` 新增诊断日志配置节：单 ns 直接传 `createFileDiagnosticLog(...)` 产物（P0 后即为完整正路）；多 ns 用导出的 manager；裸 `{emitter}` = 仅 create 尝试（legacy 冻结行为）的陷阱说明；Hub/Peer 组合根示例。`SKILL.md` 路由行同步（诊断日志/observability 类请求导流到该节）。

（原方案「类型收紧 fail-fast」**作废**——自然用法工作后不存在需要响的错误用法，裸 `{emitter}` 自定义 sink 弱化到仅文档；原「legacy 观测事件」**弱化**——plugin 不传 observer 的管道缺口（`diag-pump-drop` 在生产同样不可见）独立处理。）

## Acceptance criteria

- [ ] `FileDiagnosticLog` 具备 `runtimeEmitterFor`（identity 匹配本 namespace）；registry + raw log + open/mutate → segments 出现 `root-mutation` 记录——差分 harness B 臂语义转正为正式回归测试（现红，修后绿）
- [ ] replication apply 路径同样落盘（runtime 级 emission 共用同一装配）
- [ ] #150 legacy 契约测试零漂移（裸 `{emitter}` 字面量仍走 legacy 路径）
- [ ] 其他 namespace 的 emission 不落本流（解析 undefined → 泵内丢弃，无跨 namespace 写入）
- [ ] 无归属公共入口拒绝的落盘语义在 PR 中显式定案（接受落盘或丢弃，二选一）并写入契约测试
- [ ] P1：`@nomicore/yjs-server` 导出泛化 manager；app 内部改消费该导出
- [ ] P2：`cordis-host.md` 配置节 + `SKILL.md` 路由落地
- [ ] 根 `pnpm typecheck` 与相关包测试全绿；`namespace-diagnostic-log` 版本 bump（公共面变化）

## 备注

- 消费方切换不再需要：P0 修复后 DSH 现有接线即为正路；manager 仅服务多 ns 需求。
- 诊断会话的临时差分 harness 位于工作区未跟踪文件 `packages/namespace-registry/test/zz-ndcl-empty-segments-repro.test.ts`；AC 第 1 条应将 B 臂转正为包内正式回归测试。
- manifest.json 创建后不可变是 #153 设计行为；本 issue 的「segments 恒空」判读不受影响。
- seam 冻结面影响：registry 侧成员名与探测逻辑零改动；#150 契约测试不受影响（已核实注入路径）。

## Comments

### Comment 5664521867

Updated at: 2026-09-14T13:12:42Z
Author: welltop-jim-wang
Association: OWNER

**裁决记录（2026-09-14，维护者）**：本 issue 初版以「Host binding 形状错误」定性，主修方向为「@nomicore/yjs-server 导出正确 manager 实现 + 声明类型收紧让错误形状编译期报错」。讨论中维护者推翻该定性：

> 「`createFileDiagnosticLog(...)` 产物直接传 `diagnosticLog`」的写法没有错。如果不能正常工作，那是 bug，而不是配置错误。

据此重构：自然组合（两个 nomicore 公共导出的直接组合）必须工作；`FileDiagnosticLog` 在 registry 接缝上**静默半工作**（只记 create 尝试、runtime 级 emission 消失、零反馈）是产品缺陷。主修改为 **P0：`FileDiagnosticLog` 自绑定**（增 `runtimeEmitterFor` identity 匹配成员，registry 探测逻辑零改动即进入生产泵路径）；原「类型收紧 fail-fast」作废；「导出 manager」降级为多 namespace Host 的正路（P1）；观测事件弱化。

关键佐证（定案依据）：
- `FileDiagnosticLog` 已携带 `namespaceId` + `emitter` 全部所需信息，缺的只是被 registry 认出；
- legacy 形状合法生产消费者为零：仓内 app 用完整 manager binding，仓内 #150 契约测试全部以 `{emitter: log.emitter }` 字面量经 testing seam 注入（已核实仓内无测试直传 raw log 对象）；
- 「legacy 逐字节现行」冻结承载的是 #150→#155 过渡态兼容义务，从未是「裸 emitter 只记 create」的产品承诺。

附带收益：P0 落地后 DSH 两个部署（Hub nomicore-host / Peer mabf-runner）**零代码改动**，下个 tarball 批次 + 重启即恢复日志。
