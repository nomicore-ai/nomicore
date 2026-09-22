# WebSocket Replication Agent Instructions

## Contract

This package implements the Hub/Peer connection and namespace state machines over `@nomicore/replication-protocol`, plus role-specific Cordis plugins. Read ADR 0010, ADR 0012, and `docs/protocols/instance-replication-v1.md` before changing wire behavior, authentication, service ownership, lifecycle, backpressure, or reconciliation. Read ADR 0032 before changing the Hub-side edge/session split, the byte seam between them, OPEN admission, route-key demux, or the `createHubReplicationEdge`/`createHubSessionHost` public factories and `listen: false` SessionHost service.

## Boundaries

- Keep topology static: Hub accepts authenticated peers; Peer dials one configured Hub. Both sides remain full local replicas and may accept controlled ROOT writes.
- Bind Hub connections to the trusted identity produced before WebSocket Upgrade. `acceptTrusted` receives that identity; HELLO self-report never becomes authentication evidence.
- Preserve protocol ordering and FSM invariants: HELLO gates namespace traffic, one namespace lifecycle exists per connection, sequence and sync-round counters do not wrap, and terminal channels reopen only on a new connection.
- Route namespace ownership and raw Yjs operations through public Registry leases and ReplicationSessions. The transport layer never reaches into Runtime, Persistence, snapshots, or live Y.Doc internals.
- Keep remote apply, ACK, bootstrap, resync, epoch conflict, and protected SCHEMA/META behavior aligned with ADR 0010. ACK means sequenced live apply plus dirty registration, not flush or quorum durability.
- Keep admission bounded across handshake, ready, backpressure, and drain windows. Control/data accounting, queued bytes, early frames, timers, retries, and periodic reconciliation are observable concurrency contracts.
- Use injected transport, scheduler, randomness, and optional observer/clock seams. Observer or adapter failures must follow their documented isolation and close classifications.
- Role-specific Cordis plugins consume Instance, Clock, Timer, and Registry services. They own only listener/dialer, replication controller, connections/channels, and their published service; teardown upstream services at the composition root.
- Keep the edge/session split disciplined (ADR 0032): the seam carries only namespace-domain frames as `Uint8Array` plus the `close`/`terminateUnauthorized`/`settled`/`closed` control signals (and the append-only `connection-fatal` signal); connection-level frames never cross it. Edge validates inbound sequence header-only and stamps outbound sequence at the mux point — sessions encode `sequence=0` placeholders — keeping the wire byte-identical.
- Keep authorize on the edge side of the seam: edge fully decodes OPEN and calls the injected authorizer; an unauthorized OPEN never crosses the public byte seam, and its wire rejection (`NAMESPACE_UNAUTHORIZED`, refusal latch) is produced by edge-side production code. SessionHost consumes only the settled pre-authorized projection (`localOwner`/`read`/`submit`) and never calls authorize itself.
- Keep route-key demux O(header): namespace-domain frames expose `namespaceId` at fixed offsets (`UPDATE_CHUNK` shifted by one byte); OPEN full-decodes, ERROR uses a bounded mini-decode, and routing violations reproduce the monolith's two branches (`MALFORMED_FRAME` fatal; sink-less legal frame → synthesized `NAMESPACE_STATE_VIOLATION`). The offset layout is a synchronized-maintenance contract with codec field order, locked by structural guard tests.
- Keep the two Hub service entrances mutually exclusive: listen mode publishes `nomicoreHubReplication` and never the SessionHost service; exact `listen: false` publishes `nomicoreHubSessionHost` and consumes no `tokens`/`authorization`/`verifyToken`/`authorize` config — authentication and authorization are edge-side duties in that mode. The public factories `createHubReplicationEdge` (a plain factory, not a Cordis plugin, no Registry dependency) and `createHubSessionHost` evolve append-only once published.
- Preserve shutdown safety and follow `docs/protocols/instance-replication-v1.md` §21 as the authority for Hub close, Runtime barriers, session/lease release, and reauthentication drain behavior.
- Export production APIs through `src/index.ts`; keep programmable adapters and test controls in the explicit testing surface.

## Verification

Run the focused tests for every changed state-machine path, including auth/HELLO, open/bootstrap/live update, reconciliation, periodic reconciliation, close/GOAWAY, epoch races, backpressure, liveness timers, observer isolation, real-transport dynamics, API types, and protocol faults. For seam changes also run the edge/session split contract, OPEN admission pipeline, and route-key/wire parity guard tests. Then run the package typecheck plus root `pnpm typecheck` and `pnpm test` for any wire or lifecycle change.
