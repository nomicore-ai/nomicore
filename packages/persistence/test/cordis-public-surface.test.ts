/**
 * Red-light contract — issue #470 AC7(c)(d) (design §15 G5, R7(c), §13 AC7 row):
 * the runtime export-name surface of the four public entries must stay exactly
 * equal to the base commit snapshot captured from a detached base worktree
 * (`public-surface.base.json`, G5 capture procedure). A new public export — the
 * canonical way compatibility logic would leak into the public API — turns this
 * test red.
 *
 * The persisted snapshot gate (BASE vs snapshot) is mechanical in `gates.mjs` G5;
 * this test is the "current working tree vs snapshot" half of the same gate.
 */
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = path.join(TEST_DIR, 'fixtures/cordis-baselines/public-surface.base.json')
const SNAPSHOT = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) as Record<string, string[]>

const ENTRIES: ReadonlyArray<readonly [string, () => Promise<Record<string, unknown>>]> = [
  ['@nomicore/persistence', () => import('../src/index.js')],
  ['@nomicore/persistence/testing', () => import('../src/testing.js')],
  // Loaded by entry file path: `@nomicore/dsh-persistence` is deliberately NOT a
  // declared dependency of the core package (core-dsh-boundary guard), so the
  // package specifier is not type-resolvable from here. The exported names are
  // identical; the G5 capture imports the same base-commit entry files.
  ['@nomicore/dsh-persistence', () => import('../../dsh-persistence/src/index.js')],
  ['@nomicore/ws-replication', () => import('../../ws-replication/src/index.js')],
]

describe('AC7 公共导出面 runtime 快照（vs base 279dba4 捕获）', () => {
  it('快照本身覆盖四个 entry（三 persistence entry + ws-replication entry，R7(c)）', () => {
    expect(Object.keys(SNAPSHOT).sort()).toEqual(ENTRIES.map(([name]) => name).sort())
  })

  for (const [name, load] of ENTRIES) {
    it(`${name} 的运行时导出名集合与 base 快照严格相等`, async () => {
      const module = await load()
      expect(Object.keys(module).sort()).toEqual(SNAPSHOT[name])
    })
  }
})
