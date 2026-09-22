# Cordis host branch

Compose Nomicore inside the independent host's existing composition root. Read `$NOMICORE_ROOT/docs/integration/cordis-plugin-hosting.md` before changing plugin assembly or lifecycle.

## Process

1. Inspect the host's Cordis context ownership, configuration system, existing Timer provider, persistence/recovery identity, health/readiness model, domain startup policy, and shutdown path.
2. Install the released public packages used by the host from npm. Let the package manager resolve transitive dependencies and commit the lockfile. Use the complete local tarball graph or checkout links only when the task explicitly validates unreleased Nomicore changes; do not make local artifacts the normal consumer configuration.
3. In one Cordis `Context`, install in dependency order:
   1. `createInstancePlugin()` with one immutable `{ instanceId, role }` source; for Fiber management pass that config both to the factory and as the second `ctx.plugin(plugin, config)` argument;
   2. `createSystemClockPlugin()`;
   3. exactly one Timer provider: construct it only in an independent composition root, or consume the existing Host Timer when embedded;
   4. exactly one production Persistence plugin (`createMemoryPersistencePlugin` for ephemeral use or `createFilePersistencePlugin` for restart recovery);
   5. `createNamespaceRegistryPlugin()`, which reads role from the Instance service and has no role configuration; to enable the optional namespace diagnostic change log, pass a host-owned adapter (e.g. `createFileDiagnosticLog` from `@nomicore/namespace-diagnostic-log`) as the second `host: { diagnosticLog }` argument; see the Diagnostic change log section below for the single-namespace direct pass versus the multi-namespace manager;
   6. when embedding replication, the matching `createHubReplicationPlugin()` or `createPeerReplicationPlugin()` from `@nomicore/ws-replication` — or, when the host owns the transport edge (ADR 0032), `createHubReplicationPlugin({ listen: false })` publishing the SessionHost service; see the replication branch.
4. Call `await fiber.await()` after each provider/plugin before requiring its service. Current Cordis wrappers are thenable too, but explicit `.await()` makes lifecycle readiness and startup-error propagation unambiguous. Obtain Registry with `requireNomicoreRegistry(ctx)` and replication with `requireHubReplication(ctx)` or `requirePeerReplication(ctx)`.
5. Decide create versus recovery before startup. Recovery requires the same File `rootDir`, owner, and persisted `namespaceId`; a fresh root cannot open old IDs. Create or open each namespace and persist `lease.namespaceId`. On a Hub, await `lease.enableReplication()` before dependent consumers. On a Peer, configure/add the target and decide whether domain activation must await `waitForLive(namespaceId)`. Keep each consumer within its lease lifetime.
6. Put readiness-critical startup in the owning plugin's `async apply()` path so namespace/schema/enablement/live-wait failures reject Loader activation. Use `ctx.effect()` to register cleanup after startup, not to launch hidden background initialization. Let business code consume Registry leases and role-specific services rather than Persistence handles, raw controllers, ReplicationSessions, or live Yjs objects.
7. Expose transport liveness, namespace readiness, and domain readiness separately. Treat the Node listener `/healthz` as transport-only. Test missing dependencies, duplicate Timer prevention, invalid schema/root, recovery with matching and fresh roots, replication enablement/target setup, each Peer boot policy, business-consumer startup gating, lease release, and zero-write validation failure.
8. Shutdown in reverse ownership order: stop and drain business consumers, release their leases, dispose the role-specific replication Fiber, await `registry.shutdown()` when explicitly owned, dispose Persistence, then tear down Timer/Clock/Instance/root Context. Replication disposal drains only its listener/dialer, controller, connections, channels, and service; it never shuts down Registry or Persistence. Use one teardown chain rather than racing manual and Cordis cascade disposal.

## Diagnostic change log (诊断日志)

The optional namespace diagnostic change log is enabled by passing `host: { diagnosticLog }` to `createNamespaceRegistryPlugin()`. Two supported shapes; never hand-roll a third.

### Single namespace — pass the `createFileDiagnosticLog(...)` product directly

```ts
import { createFileDiagnosticLog } from '@nomicore/namespace-diagnostic-log';

const log = createFileDiagnosticLog({ rootDir, namespaceId, clock: { now: () => clock.now() } });
await ctx.plugin(createNamespaceRegistryPlugin({}, { diagnosticLog: log })).await();
```

The adapter is per-namespace and self-binding: its `runtimeEmitterFor(namespaceId)` returns its own emitter for exactly that namespace (data-keyed attribution), so create attempts **and** runtime-level emissions (root mutation, schema replacement, replication enable/epoch/apply) land in `segments/` of the same stream. `namespaceId` must be the namespace this log belongs to: a single-namespace log records only its own namespace, and every other namespace resolves to `undefined` and is silently dropped inside the Registry pump — use the manager below for multi-namespace hosts. An existing direct-pass wiring needs no Host code change: upgrade `@nomicore/namespace-diagnostic-log` (0.1.9 or newer) and restart.

### Multiple namespaces — use the exported `createHostDiagnosticsManager`

```ts
import { createHostDiagnosticsManager } from '@nomicore/yjs-server';

const diagnostics = createHostDiagnosticsManager(
  { rootDir, updateCapture: true, inputPolicy: 'digest' },
  { onEvent: (event) => sink(event), now: () => clock.now() },
);
await ctx.plugin(createNamespaceRegistryPlugin({}, { diagnosticLog: diagnostics.binding })).await();
```

`binding.runtimeEmitterFor(namespaceId)` keys each namespace to its own cached adapter (one writer per namespace per process). Its shared `binding.emitter` is the **unattributed** channel and always **drops + counts** (`diagnostic-log-emission-dropped` with `reason: 'unattributed'`) instead of guessing an owner. Lifecycle: call `retireNamespace(namespaceId)` before the namespace-deletion workflow so late pump traffic is dropped as `namespace-deleted` rather than recreating a deleted stream, and call `close()` once in the shutdown chain (diagnostics O(1) close, per the yjs-server teardown order) so later emissions report `manager-closed`.

### The bare `{ emitter }` trap

A hand-written `{ emitter: someLog.emitter }` literal is the frozen **#150 legacy** shape: the Registry sees an emitter but no `runtimeEmitterFor`, so it records create attempts only and structurally never produces runtime-level records — with zero errors, zero warnings, and no health event. That silent half-working shape is exactly the bug fixed in issue #393. The fix is not to add an observer; it is to pass one of the two shapes above. The two unattributed semantics are deliberately different and not interchangeable: a self-bound per-namespace log persists unattributed public-entry rejections into its own stream (single-namespace semantics), while the manager's shared channel always drops them.

### Hub and Peer composition roots

Hub (owns schema/epoch changes for its namespaces):

```ts
const log = createFileDiagnosticLog({ rootDir, namespaceId: hubNamespaceId, clock: { now: () => clock.now() } });
await ctx.plugin(createNamespaceRegistryPlugin({}, { diagnosticLog: log })).await();
```

Peer (replica of one or more remote namespaces):

```ts
const diagnostics = createHostDiagnosticsManager({ rootDir }, { onEvent: (e) => sink(e), now: () => clock.now() });
await ctx.plugin(createNamespaceRegistryPlugin({}, { diagnosticLog: diagnostics.binding })).await();
```

Replication applies (`replication-apply`) go through the same runtime diagnostic assembly as root mutations, so both Hub and Peer record them in `segments/` once the log is wired this way.

## Guardrails

- `@nomicore/dsh-persistence` is a DSH development/profile adapter, not the default third-party production choice.
- Memory persistence does not survive adapter destruction.
- File persistence recovery identity is `rootDir + owner + namespaceId`; a fresh root means no existing namespace. Treat each root as one active process's private store, never a shared database: another process must not open the same root, bypass its lock, or edit snapshots. Cross-process mutation uses the owning process's interface or a Peer with its own root; restart/migration reuses a root only after the previous owner fully disposes.
- Use public `create*Plugin()` factories and the Cordis Fiber dependency graph. Do not invent `startNomicoreHubRuntime()` / `startNomicorePeerRuntime()` helpers that create or own Instance, Timer, Persistence, and Registry: that hides Host policy and recreates the self-contained server plugin rejected by ADR 0012. Embedded replication uses role-specific factories/services from `@nomicore/ws-replication` (including the `listen: false` SessionHost mode for edge-owning hosts, ADR 0032); Node transport wiring may use `createNodeHubListenAdapter()` from `@nomicore/yjs-server`. Dynamic plugin IDs, source scanning, and `cordis_define` are not stable Nomicore contracts.

## Completion gate

Complete when startup proves Instance → Clock → Timer → Persistence → Registry → role-specific replication plugin → namespace lease → Hub enableReplication/Peer target → business consumer ordering, Registry and replication consume the same immutable identity, invalid writes remain zero-write, every consumer stays within its lease lifetime, and graceful shutdown reverses ownership by draining consumers before leases, replication, Registry, and Persistence.
