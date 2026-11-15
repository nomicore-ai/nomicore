/**
 * issue #471 — AC4 / A4-4: the DSH profile that is applied DIRECTLY (no Cordis fiber
 * `ctx.plugin()`), as the third-party minimal assembly does, keeps the documented
 * dispose order "adapter first, Cordis root fiber after" and stays idempotent.
 *
 * `createDshPersistenceProfile` assembles clock → timer → persistence synchronously
 * (`plugin.apply(ctx)`), so this test is the observable complement of the fiber-based
 * composition root: the profile owns the root release and must never release the root
 * before the adapter has settled.
 *
 * Falsifiability: swapping the two awaits in `profile.dispose()` (or dropping the
 * adapter dispose) turns the recorded order red; a non-idempotent dispose records a
 * second chain.
 */
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createDshPersistenceProfile } from '@nomicore/dsh-persistence'

const OWNER = Object.freeze({ userId: 'u' })

describe('O.dsh-profile-direct-apply-order', () => {
  it('O.dsh-profile-direct-apply.adapter-then-root', async () => {
    const profile = createDshPersistenceProfile({ adapter: 'memory' })
    const events: string[] = []
    // The profile applies clock → timer → persistence directly; both services are live
    // before any Cordis fiber exists (the "direct apply" shape itself).
    expect(profile.ctx.get('timer')).toBeDefined()
    expect(profile.ctx.get('nomicorePersistence')).toBe(profile.persistence)
    expect(profile.getStatus()).toBe('ready')

    // Record the release order by observing the two release entry points the profile calls.
    const adapter = profile.persistence as unknown as { dispose(): Promise<void> }
    const originalAdapterDispose = adapter.dispose.bind(adapter)
    adapter.dispose = async () => {
      events.push('adapter-dispose')
      const result = await originalAdapterDispose()
      events.push('adapter-disposed')
      return result
    }
    const fiber = profile.ctx.fiber as unknown as { dispose(): Promise<void> }
    const originalFiberDispose = fiber.dispose.bind(fiber)
    fiber.dispose = async () => {
      events.push('root-fiber-dispose')
      return originalFiberDispose()
    }

    // A4-4: explicit adapter dispose → then the root Cordis release.
    await profile.dispose()
    // The adapter settles first; the Cordis root release starts strictly after it.
    expect(events.slice(0, 3)).toEqual(['adapter-dispose', 'adapter-disposed', 'root-fiber-dispose'])
    expect(events.indexOf('adapter-disposed')).toBeLessThan(events.indexOf('root-fiber-dispose'))
    expect(profile.getStatus()).toBe('disposed')
    expect(profile.ctx.get('timer')).toBeUndefined()

    // Idempotent: a second dispose must not run a second chain.
    const afterFirst = events.length
    await profile.dispose()
    expect(events.length).toBe(afterFirst)
  }, 20_000)

  it('O.dsh-profile-direct-apply.no-fake-timer', async () => {
    // The profile's default timer is the real baseline TimerService: a document write
    // flushes through the real scheduler inside the deadline (never a fake timer).
    let flushed = 0
    const profile = createDshPersistenceProfile({
      adapter: 'memory',
      schedule: { debounceMs: 5, maxDirtyMs: 20 },
      memoryIo: {
        writeSnapshot: () => {
          flushed += 1
        },
      },
    })
    try {
      expect(typeof (profile.ctx.get('timer') as { timeout?: unknown }).timeout).toBe('function')
      const doc = new Y.Doc()
      doc.getMap('META').set('docId', 'd-direct')
      doc.getMap('ROOT').set('n', 7)
      const handle = await profile.persistence.createDoc(OWNER, 'd-direct', doc)
      await profile.persistence.saveDoc(handle)
      const start = Date.now()
      while (Date.now() - start < 5000 && flushed === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 5))
      }
      expect(flushed, 'the real TimerService drives the flush').toBeGreaterThan(0)
      expect(profile.getStatus()).toBe('ready')
    } finally {
      await profile.dispose()
    }
  }, 20_000)
})
