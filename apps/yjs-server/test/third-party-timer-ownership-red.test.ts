/**
 * issue #471 — AC3 (A3-2) / AC4 (A4-1…A4-3): third-party composition-root Timer ownership.
 *
 * Assembly (design §10.2, `docs/integration/cordis-plugin-hosting.md` L14–L66):
 *   Instance → clock → `new TimerService(root ctx)` → persistence fiber → registry fiber
 *   → role-specific replication plugin.
 *
 * Assertions (behaviour only):
 *   A4-1  after `persistenceFiber.dispose()` and BEFORE the root `ctx.fiber.dispose()`,
 *         `ctx.get('timer')` is still available and `timeout(() => {}, 1)` still arms;
 *   A4-2  after the root `ctx.fiber.dispose()`, the timer service is gone / cannot arm;
 *   A4-3  the TimerService is constructed on the ROOT ctx (not inside a child fiber), so
 *         unloading the persistence fiber never removes it — dependent tracking is NOT
 *         used as an automatic Timer dependency edge;
 *   A3-2  replication `stop()` does not await Registry shutdown, Registry shutdown does not
 *         wait for a replication restart, and the whole chain settles inside a 5 s deadline
 *         (a deadlock would time out and turn the test red).
 *
 * Falsifiability: if the Host accidentally disposes the root context instead of the
 * persistence fiber, A4-1 turns red; if the timer were constructed inside the persistence
 * fiber, A4-1/A4-3 turn red.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { TimerService } from '@deepseek-ai/cordis-plugin-timer'
import { createSystemClockPlugin } from '@nomicore/clock'
import { createInstancePlugin } from '@nomicore/instance'
import { createMemoryPersistencePlugin } from '@nomicore/persistence'
import { createNamespaceRegistryPlugin, requireNomicoreRegistry } from '@nomicore/namespace-registry'
import { createHubReplicationPlugin, requireHubReplication } from '@nomicore/ws-replication'

const DEADLINE_MS = 5000

/** Predicate polling with a hard deadline — never a fixed wall-clock wait (SA9-5). */
async function waitFor(predicate: () => boolean, label: string, deadlineMs = 2000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < deadlineMs) {
    if (predicate()) return
    await new Promise<void>((resolve) => setTimeout(resolve, 2))
  }
  throw new Error(`waitFor timed out after ${deadlineMs}ms: ${label}`)
}

function deadline<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const handle = setTimeout(() => reject(new Error(`${label} did not settle within ${DEADLINE_MS}ms`)), DEADLINE_MS)
      void promise.finally(() => clearTimeout(handle))
    }),
  ])
}

async function composeHost(): Promise<{
  ctx: Context
  persistenceFiber: ReturnType<Context['plugin']>
}> {
  const ctx = new Context()
  createInstancePlugin().apply(ctx, { instanceId: 'hub-1', role: 'hub' })
  await ctx.plugin(createSystemClockPlugin())
  // TimerService is constructed on the ROOT context (hosting doc L57): the service and the
  // mixed-in `timeout` live on the root, not inside a child fiber.
  new TimerService(ctx)
  const persistenceFiber = ctx.plugin(createMemoryPersistencePlugin())
  await persistenceFiber
  await ctx.plugin(createNamespaceRegistryPlugin())
  return { ctx, persistenceFiber }
}

describe('O.timer-ownership', () => {
  it('O.timer-alive.after-persistence-fiber-dispose', async () => {
    const { ctx, persistenceFiber } = await composeHost()
    try {
      // Timer is available from the assembly moment (A4-3 precondition).
      expect(ctx.get('timer')).toBeDefined()
      expect(typeof (ctx.get('timer') as { timeout?: unknown }).timeout).toBe('function')

      await persistenceFiber.dispose()

      // A4-1: the timer survived the persistence fiber unload…
      const timer = ctx.get('timer') as { timeout(callback: () => void, delay: number): () => void } | undefined
      expect(timer, 'timer service must survive the persistence fiber dispose').toBeDefined()
      let armed = false
      const dispose = timer!.timeout(() => {
        armed = true
      }, 1)
      expect(typeof dispose).toBe('function')
      await waitFor(() => armed, 'the surviving timer fires its armed callback')
      // …and can still arm: the armed callback ran on the root timer.
      expect(armed, 'the surviving timer can still arm and fire').toBe(true)
      dispose()
    } finally {
      await ctx.fiber.dispose()
    }
  }, 20_000)

  it('O.last-release.root-fiber-dispose', async () => {
    const { ctx } = await composeHost()
    await ctx.fiber.dispose()
    // A4-2: after the root release the timer is unavailable and cannot arm.
    expect(ctx.get('timer')).toBeUndefined()
    expect(() => {
      const timer = ctx.get('timer') as { timeout(callback: () => void, delay: number): () => void } | undefined
      timer!.timeout(() => undefined, 1)
    }).toThrow()
  }, 20_000)

  it('O.no-auto-edge.persistence-fiber-unload-keeps-timer', async () => {
    const { ctx, persistenceFiber } = await composeHost()
    try {
      // A4-3: the timer is NOT a dependent of the persistence fiber — after the unload the
      // root timer is still published and still armable, while the persistence service (the
      // fiber's own provide) is gone.
      await persistenceFiber.dispose()
      const after = ctx.get('timer') as { timeout(callback: () => void, delay: number): () => void } | undefined
      expect(after, 'dependent tracking must not remove the root timer').toBeDefined()
      expect(typeof after!.timeout).toBe('function')
      let fired = false
      const dispose = after!.timeout(() => { fired = true }, 1)
      await waitFor(() => fired, 'the orphaned-by-design root timer fires its armed callback')
      expect(fired, 'the orphaned-by-design root timer still arms').toBe(true)
      dispose()
      expect(ctx.get('nomicorePersistence')).toBeUndefined()
    } finally {
      await ctx.fiber.dispose()
    }
  }, 20_000)

  it('O.no-cycle.replication-stop-and-registry-shutdown', async () => {
    const { ctx } = await composeHost()
    try {
      const plugin = createHubReplicationPlugin(
        { listen: { host: '127.0.0.1', port: 0 }, tokens: [], authorization: [] },
        { listen: { listen: async () => ({ port: 0, close: async () => undefined }) } } as never,
      )
      const fiber = ctx.plugin(plugin)
      await fiber.await()
      const replication = requireHubReplication(ctx)
      const registry = requireNomicoreRegistry(ctx)

      // A3-2: replication stop() resolves without waiting for Registry shutdown…
      await deadline(replication.stop(), 'replication.stop()')
      expect(replication.status.state).toBe('stopped')
      // …and Registry shutdown afterwards resolves without waiting for a replication restart.
      await deadline(registry.shutdown(), 'registry.shutdown()')

      // Both halves settled inside the deadline: no wait cycle exists.
      await deadline(fiber.dispose(), 'replication fiber dispose')
      await deadline(ctx.fiber.dispose(), 'root fiber dispose')
      expect(ctx.get('timer')).toBeUndefined()
    } finally {
      await ctx.fiber.dispose().catch(() => undefined)
    }
  }, 20_000)
})
