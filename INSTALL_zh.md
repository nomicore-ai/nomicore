# 安装与开发 Nomicore

[English](INSTALL.md) | 中文

本文介绍 Nomicore 的安装、本地包构建、发布、部署和仓库开发。项目概述和示例请参阅[中文 README](README_zh.md)。

## 关键使用规则

1. 宿主项目拥有自己的 `schema.vfsl`、生成类型、业务代码、配置、测试与部署；Nomicore 是依赖，不接管宿主领域。
2. Namespace 写入必须使用生成的 `VfslPathMap` 投影和 projection-aware typecheck，通过宿主 typed adapter 调用 `NamespaceLease.mutateData()`。运行时 SCHEMA 校验不能代替编译期路径和值检查。
3. 业务 mutation 应最小、可合并、有语义；修改一个叶子时不要读取并替换整个 ROOT 或父对象。
4. File Persistence `rootDir` 是单进程私有存储，不是共享数据库。跨进程数据修改使用拥有者业务接口或不同 root 之间的 Hub/Peer replication；不得并发打开同一 root 或直接编辑 snapshot。
5. SCHEMA replacement 只由 Hub 通过 existing namespace lease 执行。更新后需刷新类型投影，并逐台确认 Peer 已 re-arm（`schema-rearm-applied` 事件或与 Hub 一致的 `getActiveSchema()` 指纹）再启用新路径写；Peer reset/重启仅为运维兜底。

相关指南：

- [外部项目 VFSL Codegen 与类型安全访问](docs/integration/external-project-vfsl-codegen.md)
- [第三方 Cordis Host 装配](docs/integration/cordis-plugin-hosting.md)
- [Hub/Peer standalone 部署与运维](docs/integration/hub-peer-deployment.md)
- [Schema 演进升级 runbook](docs/integration/schema-evolution.md)
- [本机源码 linking](docs/integration/local-package-linking.md)

## 包与目录

```text
packages/
├── vfsl-protocol/          # 生成类型使用的路径访问协议
├── vfsl/                   # VFSL parser/evaluator/validator
├── vfsl-codegen/           # TypeScript projection generator
├── doc-runtime/            # Yjs 载体物化、读取和校验 mutation
├── namespace-runtime/      # Namespace 能力与 write sequencer
├── clock/                  # Cordis wall-clock service
├── instance/               # instanceId + role service
├── persistence/            # Memory/File persistence
├── namespace-registry/     # Registry、lease 与 replication sessions
├── namespace-diagnostic-log/ # 可选 best-effort 诊断变更日志
├── replication-protocol/   # instance replication v1 codec
├── ws-replication/         # Hub/Peer controllers 与 Cordis plugins
└── dsh-persistence/        # DSH 开发/探针 profile

apps/yjs-server/            # standalone Hub/Peer composition root 与 Node WS adapters
domains/                    # 仓库内示例/测试领域
docs/                       # ADR、protocol、VFSL 与 integration guides
artifacts/local-packages/   # 本地集成 tarballs 和 manifest
```

## 从 npm 安装（消费方首选）

全部 `@nomicore/*` 包已经公开发布到 npm。仅使用 Nomicore 的独立项目应优先安装 registry 版本，让 package manager 解析正式版本和传递依赖：

```bash
pnpm add @nomicore/namespace-registry @nomicore/persistence
# 需要嵌入 Hub/Peer 时
pnpm add @nomicore/instance @nomicore/clock @nomicore/ws-replication @nomicore/yjs-server
# 可选 best-effort namespace 诊断变更日志
pnpm add @nomicore/namespace-diagnostic-log
# 需要生成类型投影时
pnpm add -D @nomicore/vfsl-codegen @nomicore/vfsl-protocol
```

不要为了普通消费 clone Nomicore checkout、link `src` 或维护完整本地 tarball 闭包。固定版本的生产部署应把选择的 npm 版本和 lockfile 一并提交。源码 linking 和本地 tarballs 只用于开发 Nomicore 本身、验证尚未发布的修改或发布流程。

## 构建本地 tarballs（Nomicore 开发/发布）

只有在联调未发布的仓库修改或准备 npm 发布时才构建本地 tarball 集。普通消费优先使用上面的 npm 安装方式。

### 1. 准备 checkout

```bash
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
```

要求 Node.js 20+ 和仓库声明的 pnpm 版本。

### 2. 构建完整包集

```bash
pnpm run pack:local
```

该命令会：

1. 清空 `artifacts/local-packages/`；
2. 按依赖顺序编译每个可发布包的 `dist`；
3. 将每个包打包为确定性的 tarball；
4. 写入 `artifacts/local-packages/manifest.json`。

默认输出示例：

```text
artifacts/local-packages/
├── manifest.json
├── nomicore-vfsl-protocol-<version>.tgz
├── nomicore-vfsl-<version>.tgz
├── nomicore-vfsl-codegen-<version>.tgz
├── nomicore-doc-runtime-<version>.tgz
├── nomicore-clock-<version>.tgz
├── nomicore-instance-<version>.tgz
├── nomicore-persistence-<version>.tgz
├── nomicore-dsh-persistence-<version>.tgz
├── nomicore-namespace-runtime-<version>.tgz
├── nomicore-namespace-registry-<version>.tgz
├── nomicore-replication-protocol-<version>.tgz
├── nomicore-ws-replication-<version>.tgz
└── nomicore-yjs-server-<version>.tgz
```

也可以将输出写入其他目录：

```bash
pnpm run pack:local -- /absolute/path/to/output
```

`manifest.json` 是包名到实际版本化文件名的权威映射。不要在消费项目中硬编码示例中的版本号。生成的 `*.tgz` 是本地/CI 构建产物，已被 Git 忽略；clone 后必须运行 `pnpm pack:local` 生成，不能依赖仓库中预置的归档文件。仓库跟踪的 manifest 用于声明当前包集和文件名基线，并会在每次构建时重写。

> 只要 tarball 内容发生变化，相应 package 的 `version` 就必须先更新。不要以相同版本号发布不同内容。

### 3. 在独立项目中测试未发布构建

以下 `file:` 方式只适用于验证尚未发布的仓库修改。测试本地构建时，应让相关 `@nomicore/*` 依赖都指向同一批 manifest tarballs，避免意外混合 registry 与本地版本。

示例 `package.json`（文件名以本次生成的 manifest 为准）：

```jsonc
{
  "dependencies": {
    "@nomicore/instance": "file:../nomicore/artifacts/local-packages/nomicore-instance-0.1.0.tgz",
    "@nomicore/clock": "file:../nomicore/artifacts/local-packages/nomicore-clock-0.1.0.tgz",
    "@nomicore/persistence": "file:../nomicore/artifacts/local-packages/nomicore-persistence-0.2.3.tgz",
    "@nomicore/namespace-registry": "file:../nomicore/artifacts/local-packages/nomicore-namespace-registry-0.1.9.tgz",
    "@nomicore/replication-protocol": "file:../nomicore/artifacts/local-packages/nomicore-replication-protocol-0.1.1.tgz",
    "@nomicore/ws-replication": "file:../nomicore/artifacts/local-packages/nomicore-ws-replication-0.1.4.tgz",
    "@nomicore/yjs-server": "file:../nomicore/artifacts/local-packages/nomicore-yjs-server-0.1.3.tgz"
  }
}
```

实际闭包还可能包含 `vfsl-protocol`、`vfsl`、`doc-runtime`、`namespace-runtime` 和 `namespace-diagnostic-log`；以 package manager 报告及 `manifest.json` 为准。更新 tarballs 后，在消费项目重新执行 package manager install，确保 lockfile 记录新文件及其完整性信息。

### 4. 验证 tarball 消费

消费项目应从 packed `dist` 导入，不应通过 `nomicore-source` condition、源码路径或 checkout 内部 subpath 运行生产集成。至少执行：

```bash
pnpm install
pnpm typecheck
pnpm test
```

对于 typed Namespace writers，还要执行宿主项目自己的生成检查：

```bash
pnpm nomicore:generate
pnpm nomicore:generate:check
pnpm exec tsc -p <projection-aware-tsconfig> --listFilesOnly
```

`--listFilesOnly` 输出必须包含该业务 package 使用的准确 projection 文件。

## npm 发布准备与发布

所有 `@nomicore/*` 包采用 MIT 许可证，并配置为 npm public scoped packages。`scripts/package-catalog.mjs` 是构建、验证和发布所使用的包顺序的唯一事实来源。

### 构建并验证

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm run pack:local
pnpm publish:verify
pnpm publish:reproducible
```

`publish:verify` 对每个 tarball 检查：

- package 的 `name`、`version` 与 manifest 文件名一致；
- package 为 public、非 private、采用 MIT 许可证，并指向 public npm registry；
- dependencies 中没有 `workspace:` 或 `file:` protocol；
- 所有 packed `exports` 与 `bin` target 均存在；
- 对尚未发布的版本执行 `npm publish --dry-run --json --ignore-scripts` 能够成功。

默认情况下，`publish:verify` 还会查询 npm registry：已发布的同版本包必须与本地 tarball 具有相同的 integrity；尚未发布的版本必须通过 npm dry run。普通源码 PR 的 CI 设置 `NOMICORE_VERIFY_REGISTRY_INTEGRITY=0`，只检查 tarball 结构；registry integrity、版本提升和 npm publish dry run 仍是正式发布门禁。

`publish:reproducible` 会从同一份源码独立构建两套 tarballs，并要求每个 package 的 SHA-256 完全一致。CI 的 Node 20/24 matrix 同时验证包结构和可重现性。

### 安全 dry run

```bash
pnpm publish:packages
```

该模式会再次执行验证，并按依赖顺序为全部 package 执行 `npm publish --dry-run`，不会创建正式发布。

### 正式发布

正式发布要求：

- 当前分支为 `main`；
- Git working tree 完全干净；
- `npm whoami` 对应的账号具有 `nomicore` organization 的发布权限；
- 每个选定的 package/version 尚未存在于 npm；
- 每个发生变化的 package 均已先提升版本，再重新构建 manifest 和 tarballs。

执行：

```bash
pnpm publish:packages -- --publish
```

需要 npm provenance 时：

```bash
pnpm publish:packages -- --publish --provenance
```

脚本会按依赖顺序逐个发布，并在第一次失败时停止。发布后，应在全新临时项目中从 npm 安装顶层 package，并运行 typecheck/runtime smoke tests，确认 registry 消费不依赖 checkout source。

## 第三方 Cordis Host 装配

嵌入式 Host 使用公开 plugin factories，并按以下依赖顺序启动：

```text
Instance
→ Clock
→ Host-owned Timer
→ Memory/File Persistence
→ Namespace Registry
→ role-specific Hub/Peer replication plugin
→ namespace lease / replication readiness
→ domain service
```

Node Host 可从 `@nomicore/yjs-server` 导入以下 adapters：

- `createNodeHubListenAdapter()`
- `createNodePeerDial()`

详细的 readiness、Timer 所有权、File roots、Peer reconnect 与 teardown 要求见 [Cordis Host 指南](docs/integration/cordis-plugin-hosting.md)。

## Standalone Hub/Peer

`@nomicore/yjs-server` 提供 `nomicore-yjs-server` CLI。从 npm 安装后运行：

```bash
pnpm exec nomicore-yjs-server --config /path/to/config.json
# 或
NOMICORE_CONFIG=/path/to/config.json pnpm exec nomicore-yjs-server
```

配置、NDJSON 管理接口、TLS、root locking、Hub restart、Peer recovery 和 reset runbook 见 [Hub/Peer 部署指南](docs/integration/hub-peer-deployment.md)。

## 开发与验证

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm run pack:local
```

常用工具：

```bash
pnpm schema:check /absolute/path/to/schema.vfsl
pnpm generate --domains /absolute/path/to/host
```

CI 使用 Node 20 和 Node 24，配置位于 `.github/workflows/ci.yml`。
