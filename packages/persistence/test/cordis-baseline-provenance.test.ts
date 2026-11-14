/**
 * Red-light contract — issue #470 AC4 / AC5 (design §8.3–§8.5, §13 AC4 row,
 * §14 D8): artifact identity assertions run BEFORE any behaviour assertion.
 *
 * Every run asserts the two-position resolution identity (test module position
 * and the production leaf's directory position agree, byte for byte, on the
 * same realpath) and that exactly one `@deepseek-ai/cordis` is reachable from
 * every declaring workspace package (no second copy).
 *
 * Baseline-specific identity:
 *   - runner mode (`NOMICORE_CORDIS_BASELINE` set): the resolved realpath must
 *     lie inside `NOMICORE_CORDIS_BASELINE_ROOT`, the package versions must match
 *     `baselines.json`, and the pinned sha512 integrities must equal the
 *     reference values from the SA6 appendix A table (a silent pin downgrade is
 *     red). B3 additionally re-derives the build output hashes from the
 *     installed overlay, and — with the pinned clone available — re-derives the
 *     commit, the clean check and the full `git ls-tree` blob table and compares
 *     them with `provenance-b3.json`, plus the recorded build recipe.
 *   - default mode (repository layout, no env): the identity assertions still
 *     run against the repository install; the B3-only block is not applicable
 *     because the default layout is B1 by construction (the B3 identity is
 *     asserted in the B3 matrix cells, never skipped there).
 */
import { describe, expect, it } from 'vitest'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_DIR = path.dirname(TEST_DIR)
const REPO = path.resolve(PACKAGE_DIR, '../..')
const FIXTURES = path.join(TEST_DIR, 'fixtures/cordis-baselines')
const BASELINES = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, 'baselines.json'), 'utf8'),
) as {
  base: string
  dshCommit: string
  baselines: Record<string, {
    kind: string
    expectedChannel: string
    commit?: string
    packages: Record<string, { version: string, integrity?: string }>
  }>
}
const PROVENANCE = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, 'provenance-b3.json'), 'utf8'),
) as {
  commit: string
  buildRecipe: { honestyNote: string, toolchain: { node: string, typescript: string }, perPackage: Record<string, unknown> }
  sourceBlobs: Record<string, string>
  outputs: Record<string, { libTreeSha256: string, libIndexSha256: string, typesIndexSha256: string }>
  crossChecks: Record<string, string>
}

/** SA6 appendix A integrity anchors — the tracked pins must never drift from these. */
const REFERENCE_INTEGRITY: Record<string, Record<string, string>> = {
  B1: {
    '@deepseek-ai/cordis': 'sha512-YBdskTU2Po1kru3GgcUWUbkTsPMA9LkSQDAY8rBkFJeajdgcQad3QPJZE26JyK99Xb6HaASvoXg2DSUTeN/0Nw==',
    '@deepseek-ai/cordis-plugin-timer': 'sha512-IOkey1VNmJwYa5U8bksyMOnM7mtirqjjbWLr3xA8QybLMK0sMooG3a6iJwtvd8P3MFwo3FQibEg+JPixp37MEw==',
    '@deepseek-ai/cosmokit': 'sha512-muBOKtSrUKU5m/xpq8ZXWL6hQ/jgd4PhU2PqH97bcxIiLEJfNwZOGQEx4t/aS/GgxRAR+ra9pMHPMtTHU4sqqA==',
  },
  B2: {
    '@deepseek-ai/cordis': 'sha512-CJrjNyBkKn1SfvBQUcgFYKFnLjS+uKrhdMsbHU60xabvi12d+xQ+IQSNlME5Z+B+4Zi6n4BDknKY94tEPeo47w==',
    '@deepseek-ai/cordis-plugin-timer': 'sha512-DTFp2IcK4Xnp0BWG546fwgeKjrBcSm9a9QjCtaV5Ko9hxiB/Cg03FINSNiR7OEbeg7/s4Y7QBxgQYFVYRl9V+g==',
    '@deepseek-ai/cosmokit': 'sha512-5O1S53mZiJyZYcvxxD0Qv1EY7qFPSxbGyD8CbVK6gw7W9FvcXZj2YIX1ZkOqyQQ3Xt2rFkZDHJv0+V3Zmmp8CA==',
  },
}

const BASELINE_ID = (process.env.NOMICORE_CORDIS_BASELINE ?? 'B1') as 'B1' | 'B2' | 'B3'
const BASELINE_ROOT = process.env.NOMICORE_CORDIS_BASELINE_ROOT
const TREE_ROOT = process.env.NOMICORE_CORDIS_TREE_ROOT ?? REPO
const DSH_CLONE = process.env.NOMICORE_CORDIS_DSH_CLONE
const baseline = BASELINES.baselines[BASELINE_ID]!
const DEPENDENCIES = ['@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-timer'] as const

function sha256hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function treeDigest(root: string): string {
  const lines: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (entry.isFile()) lines.push(`${path.relative(root, abs)}:${sha256hex(fs.readFileSync(abs))}`)
    }
  }
  walk(root)
  return sha256hex(Buffer.from(lines.join('\n'), 'utf8'))
}

function packageDirOf(entry: string): string {
  let dir = path.dirname(entry)
  for (let i = 0; i < 12; i += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return fs.realpathSync(dir)
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`no package.json above ${entry}`)
}

function resolvePackage(requireFrom: string, name: string): { entry: string, dir: string } {
  const require = createRequire(requireFrom)
  const entry = require.resolve(name)
  return { entry, dir: packageDirOf(entry) }
}

function listWorkspaceManifests(root: string): string[] {
  const manifests: string[] = []
  for (const top of ['packages', 'apps', 'domains']) {
    const dir = path.join(root, top)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      const manifest = path.join(dir, name, 'package.json')
      if (fs.existsSync(manifest)) manifests.push(manifest)
    }
  }
  return manifests
}

function insideBaselineRoot(target: string): boolean {
  if (BASELINE_ROOT === undefined) return true
  const root = fs.realpathSync(BASELINE_ROOT)
  return target === root || target.startsWith(root + path.sep)
}

// ---------------------------------------------------------------- identity (all baselines)

describe('工件身份：版本 + realpath 双位置一致（测试开始时先做身份断言）', () => {
  it(`基线 ${BASELINE_ID}：两个解析位置指向同一 realpath，且在基线 overlay 内`, () => {
    const testPosition = createRequire(import.meta.url)
    const productionPosition = createRequire(path.join(PACKAGE_DIR, 'src/service.ts'))
    for (const name of DEPENDENCIES) {
      const fromTest = packageDirOf(testPosition.resolve(name))
      const fromProduction = packageDirOf(productionPosition.resolve(name))
      expect(fromTest, `${name} resolves to two different realpaths`).toBe(fromProduction)
      expect(insideBaselineRoot(fromTest), `${name} resolved outside the ${BASELINE_ID} overlay: ${fromTest}`).toBe(true)
      const manifest = JSON.parse(fs.readFileSync(path.join(fromTest, 'package.json'), 'utf8')) as { version: string }
      expect(manifest.version, `${name} version mismatch`).toBe(baseline.packages[name]!.version)
    }
    // Cosmokit is not a declared dependency of persistence; it is asserted from
    // each of its declarers' resolved positions (transitive binding, SA6 §12.1).
    const cordisDir = packageDirOf(productionPosition.resolve('@deepseek-ai/cordis'))
    const timerDir = packageDirOf(productionPosition.resolve('@deepseek-ai/cordis-plugin-timer'))
    const cosmokitFromCordis = packageDirOf(createRequire(path.join(cordisDir, 'package.json')).resolve('@deepseek-ai/cosmokit'))
    const cosmokitFromTimer = packageDirOf(createRequire(path.join(timerDir, 'package.json')).resolve('@deepseek-ai/cosmokit'))
    expect(cosmokitFromCordis).toBe(cosmokitFromTimer)
    expect(insideBaselineRoot(cosmokitFromCordis)).toBe(true)
    const cosmokitManifest = JSON.parse(fs.readFileSync(path.join(cosmokitFromCordis, 'package.json'), 'utf8')) as { version: string }
    expect(cosmokitManifest.version).toBe(baseline.packages['@deepseek-ai/cosmokit']!.version)
  })

  it(`基线 ${BASELINE_ID}：工作区内声明的 @deepseek-ai/cordis 恰有一份可达（无第二份）`, () => {
    const realpaths = new Set<string>()
    for (const manifestPath of listWorkspaceManifests(TREE_ROOT)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        name?: string
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const deps = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }
      if (deps['@deepseek-ai/cordis'] === undefined) continue
      realpaths.add(packageDirOf(createRequire(manifestPath).resolve('@deepseek-ai/cordis')))
    }
    expect(realpaths.size, `expected exactly one reachable @deepseek-ai/cordis, got ${[...realpaths].join(', ')}`).toBe(1)
  })

  it(`基线 ${BASELINE_ID}：运行器声明的基线与夹具清单一致（环境自检）`, () => {
    expect(['B1', 'B2', 'B3']).toContain(BASELINE_ID)
    expect(baseline.expectedChannel).toMatch(/^(legacy|symbol)$/)
    const declaredChannel = process.env.NOMICORE_CORDIS_EXPECTED_CHANNEL
    if (declaredChannel !== undefined) expect(declaredChannel).toBe(baseline.expectedChannel)
    if (process.env.NOMICORE_CORDIS_RUNNER_MODE === '1') {
      expect(BASELINE_ROOT, 'NOMICORE_CORDIS_BASELINE_ROOT is required in runner mode').toBeDefined()
      expect(process.env.NOMICORE_CORDIS_TREE_ROOT, 'NOMICORE_CORDIS_TREE_ROOT is required in runner mode').toBeDefined()
      expect(fs.existsSync(BASELINE_ROOT!)).toBe(true)
    }
    if (BASELINE_ID === 'B3') {
      expect(DSH_CLONE, 'NOMICORE_CORDIS_DSH_CLONE is required for the B3 provenance cell').toBeDefined()
    }
  })

  it(`基线 ${BASELINE_ID}：baselines.json 的 integrity 钉值未被下调（SA6 附录 A 参照）`, () => {
    if (baseline.kind !== 'npm') {
      expect(baseline.kind).toBe('dsh')
      return
    }
    const reference = REFERENCE_INTEGRITY[BASELINE_ID as 'B1' | 'B2']!
    for (const [name, integrity] of Object.entries(reference)) {
      expect(baseline.packages[name]!.integrity, `${name} integrity pin drifted`).toBe(integrity)
    }
  })
})

// ---------------------------------------------------------------- B3 provenance

// Registered only for the B3 cells: the B3 clone/build identity is not
// applicable to the npm baselines (nothing is skipped inside a B3 cell).
const b3Suite = BASELINE_ID === 'B3' ? describe : undefined

b3Suite?.('B3 provenance：commit/clean、ls-tree blob 全表、构建配方、输出哈希（R5 八项）', () => {
  it('commit 钉死且 clone clean；provenance 记录的 commit 与 baselines.json 一致', () => {
    expect(PROVENANCE.commit).toBe(BASELINES.dshCommit)
    expect(baseline.commit).toBe(BASELINES.dshCommit)
    expect(DSH_CLONE, 'NOMICORE_CORDIS_DSH_CLONE is required to verify the pinned clone').toBeDefined()
    const head = execFileSync('git', ['-C', DSH_CLONE!, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    expect(head).toBe(BASELINES.dshCommit)
    const porcelain = execFileSync('git', ['-C', DSH_CLONE!, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
    expect(porcelain).toBe('')
  })

  it('vendored source blob 哈希与 provenance-b3.json 逐文件全表一致', () => {
    const output = execFileSync(
      'git',
      ['-C', DSH_CLONE!, 'ls-tree', '-r', BASELINES.dshCommit, '--', 'vendor/cordis', 'vendor/timer', 'vendor/cosmokit'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    )
    const actual: Record<string, string> = {}
    for (const line of output.split('\n')) {
      if (!line.trim()) continue
      const match = /^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/.exec(line)
      expect(match, `unparsable ls-tree line: ${line}`).not.toBeNull()
      const [, , type, sha, file] = match!
      if (type !== 'blob') continue
      expect(sha, `ls-tree line without a blob hash: ${line}`).toBeDefined()
      expect(file, `ls-tree line without a path: ${line}`).toBeDefined()
      actual[file!] = sha!
    }
    const expected = PROVENANCE.sourceBlobs
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort())
    for (const file of Object.keys(expected)) {
      expect(actual[file], `source blob mismatch for ${file}`).toBe(expected[file])
    }
    // Cross-checks published in the SA6 appendix A table.
    expect(expected['vendor/cordis/src/context.ts']).toBe('951a0ddae440787d15798144370bf57508c390d3')
    expect(expected['vendor/cordis/src/utils.ts']).toBe('4337b9d6c213ef90f47b982675e92302ba117f9a')
    expect(expected['vendor/timer/src/index.ts']).toBe('8d133e5c7ffab583e4612d51217d203b7913de72')
    expect(expected['vendor/cosmokit/src/types.ts']).toBe('0aab4420c16776750ae4c5891ec3d6c3a1a8231b')
  })

  it('构建配方完整记录且诚实标注（最小 tsc 构建，非官方 tsdown 流水线）', () => {
    expect(PROVENANCE.buildRecipe.perPackage['@deepseek-ai/cordis']).toBeDefined()
    expect(PROVENANCE.buildRecipe.perPackage['@deepseek-ai/cordis-plugin-timer']).toBeDefined()
    expect(PROVENANCE.buildRecipe.perPackage['@deepseek-ai/cosmokit']).toBeDefined()
    expect(PROVENANCE.buildRecipe.honestyNote).toContain('NOT the official DSH')
    expect(PROVENANCE.buildRecipe.toolchain.typescript.length).toBeGreaterThan(0)
    expect(PROVENANCE.buildRecipe.toolchain.node.length).toBeGreaterThan(0)
    const cordisRecipe = PROVENANCE.buildRecipe.perPackage['@deepseek-ai/cordis'] as {
      rootDir: string, outDir: string, declarationDir: string, rewriteRelativeImportExtensions: boolean
    }
    expect(cordisRecipe.rootDir).toBe('src')
    expect(cordisRecipe.outDir).toBe('lib')
    expect(cordisRecipe.declarationDir).toBe('lib/types')
    expect(cordisRecipe.rewriteRelativeImportExtensions).toBe(true)
  })

  it('实际使用的工件输出哈希与 provenance 一致（timer/cosmokit 与 npm 逐字节相同⇒realpath+输出哈希是唯一区分通道）', () => {
    const require = createRequire(path.join(PACKAGE_DIR, 'src/service.ts'))
    const dirs: Record<string, string> = {
      '@deepseek-ai/cordis': packageDirOf(require.resolve('@deepseek-ai/cordis')),
      '@deepseek-ai/cordis-plugin-timer': packageDirOf(require.resolve('@deepseek-ai/cordis-plugin-timer')),
      '@deepseek-ai/cosmokit': packageDirOf(
        createRequire(path.join(packageDirOf(require.resolve('@deepseek-ai/cordis')), 'package.json')).resolve('@deepseek-ai/cosmokit'),
      ),
    }
    for (const [name, dir] of Object.entries(dirs)) {
      const expected = PROVENANCE.outputs[name]!
      expect(expected, `provenance has no output record for ${name}`).toBeDefined()
      expect(treeDigest(path.join(dir, 'lib')), `${name} lib tree hash drifted`).toBe(expected.libTreeSha256)
      expect(sha256hex(fs.readFileSync(path.join(dir, 'lib/index.js'))), `${name} lib/index.js hash drifted`).toBe(expected.libIndexSha256)
      expect(
        sha256hex(fs.readFileSync(path.join(dir, 'lib/types/index.d.ts'))),
        `${name} lib/types/index.d.ts hash drifted`,
      ).toBe(expected.typesIndexSha256)
      expect(insideBaselineRoot(dir), `${name} is not the DSH source build`).toBe(true)
    }
  })
})
