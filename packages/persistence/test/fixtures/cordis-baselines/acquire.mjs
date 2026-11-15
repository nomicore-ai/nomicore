#!/usr/bin/env node
/**
 * Artifact acquisition for the three Cordis baselines of issue #470 (ADR 0035).
 *
 * B1/B2: npm registry tarballs pinned by sha512 integrity in `baselines.json`
 *        (design §8.2). The integrity is never read from live registry metadata.
 * B3:    sparse clone of the DSH commit pinned in `baselines.json` plus a
 *        minimal tsc source-build of the vendored cordis / timer / cosmokit
 *        packages (design §8.3). Output hashes are verified against
 *        `provenance-b3.json`.
 *
 * Idempotent: a cache hit is re-verified (integrity / rev-parse / porcelain /
 * ls-tree blobs / output hashes) — never trusted blindly. Any failure is loud
 * (exit 2 with a stage label); there is no fallback artifact and no skip.
 *
 * Command surface: node + git + registry HTTPS GET only (design §9/§18 I4, no
 * bare pnpm/npm, no tar/npm CLI).
 */
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../../..')
const CACHE = path.join(REPO, '.cache/cordis-baselines')
const MANIFEST_PATH = path.join(HERE, 'baselines.json')
const PROVENANCE_PATH = path.join(HERE, 'provenance-b3.json')
const MANIFEST = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

const BUILD_ORDER = ['cosmokit', 'cordis', 'timer']
const DSH_PACKAGE_NAME = {
  cosmokit: '@deepseek-ai/cosmokit',
  cordis: '@deepseek-ai/cordis',
  timer: '@deepseek-ai/cordis-plugin-timer',
}
const DSH_DIR = {
  cosmokit: 'vendor/cosmokit',
  cordis: 'vendor/cordis',
  timer: 'vendor/timer',
}

function fail(stage, message) {
  console.error(`[acquire] FAIL <${stage}> ${message}`)
  process.exit(2)
}

function log(stage, message) {
  console.log(`[acquire] ${stage}: ${message}`)
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}

function sha512base64(buffer) {
  return `sha512-${crypto.createHash('sha512').update(buffer).digest('base64')}`
}

function sha256hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/** Deterministic digest of a directory tree: sha256 over sorted `rel:sha256` lines. */
function treeDigest(root) {
  const lines = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (entry.isFile()) lines.push(`${path.relative(root, abs)}:${sha256hex(fs.readFileSync(abs))}`)
    }
  }
  walk(root)
  return sha256hex(Buffer.from(lines.join('\n'), 'utf8'))
}

// ---------------------------------------------------------------- tar (pure node)

function cstr(buffer, start, length) {
  let end = start
  const limit = start + length
  while (end < limit && buffer[end] !== 0) end++
  return buffer.subarray(start, end).toString('utf8')
}

/** Minimal ustar extractor: strips the leading `package/` component. */
function extractTarGz(buffer, destDir) {
  const tar = zlib.gunzipSync(buffer)
  let offset = 0
  const root = path.resolve(destDir)
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const prefix = cstr(header, 345, 155)
    const rawName = cstr(header, 0, 100)
    const name = (prefix ? `${prefix}/${rawName}` : rawName).replace(/^package\//, '')
    const size = Number.parseInt(cstr(header, 124, 12).trim() || '0', 8)
    const typeflag = String.fromCharCode(header[156] === 0 ? 48 : header[156])
    offset += 512
    const data = tar.subarray(offset, offset + size)
    offset += Math.ceil(size / 512) * 512
    if (!name) continue
    const target = path.resolve(root, name)
    if (target !== root && !target.startsWith(root + path.sep)) {
      fail('tar', `refusing path traversal entry ${name}`)
    }
    if (typeflag === '5') {
      mkdirp(target)
    } else if (typeflag === '0') {
      mkdirp(path.dirname(target))
      fs.writeFileSync(target, data)
    }
  }
}

// ---------------------------------------------------------------- npm tarballs

async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

/** npm registry canonical tarball URL (scoped packages use the basename). */
function tarballUrl(name, version) {
  const base = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name
  return `https://registry.npmjs.org/${name}/-/${base}-${version}.tgz`
}

async function ensureTarball(name, spec) {
  const dir = path.join(CACHE, 'npm/tarballs')
  mkdirp(dir)
  const file = path.join(dir, `${name.replace('/', '+')}-${spec.version}.tgz`)
  let bytes
  if (fs.existsSync(file)) {
    bytes = fs.readFileSync(file)
    log('npm', `cache hit ${name}@${spec.version}`)
  } else {
    bytes = await fetchBytes(tarballUrl(name, spec.version))
    fs.writeFileSync(file, bytes)
    log('npm', `downloaded ${name}@${spec.version}`)
  }
  const actual = sha512base64(bytes)
  if (actual !== spec.integrity) {
    fail('integrity', `${name}@${spec.version} sha512 mismatch: pinned ${spec.integrity}, got ${actual}`)
  }
  return { file, bytes }
}

/** Extract one tarball into `<overlay>/node_modules/<name>`. */
function extractPackage(bytes, overlayDir, name) {
  const target = path.join(overlayDir, 'node_modules', ...name.split('/'))
  rmrf(target)
  mkdirp(target)
  extractTarGz(bytes, target)
  const manifestPath = path.join(target, 'package.json')
  if (!fs.existsSync(manifestPath)) fail('extract', `${name} tarball has no package.json`)
  return target
}

async function acquireNpmBaseline(baseline, overlayDir) {
  const entries = Object.entries(baseline.packages)
  if (entries.length !== 3) fail('npm', `${baseline.id} must pin exactly cordis/timer/cosmokit`)
  for (const [name, spec] of entries) {
    const { bytes } = await ensureTarball(name, spec)
    const dir = extractPackage(bytes, overlayDir, name)
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    if (manifest.version !== spec.version) {
      fail('npm', `${name} extracted version ${manifest.version} != pinned ${spec.version}`)
    }
  }
  for (const [name, spec] of Object.entries(baseline.support ?? {})) {
    const { bytes } = await ensureTarball(name, spec)
    extractPackage(bytes, overlayDir, name)
  }
  return { overlayDir }
}

// ---------------------------------------------------------------- DSH clone + build

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options })
}

function ensureClone(commit) {
  const cloneDir = path.join(CACHE, 'dsh/clone')
  if (!fs.existsSync(path.join(cloneDir, '.git'))) {
    rmrf(cloneDir)
    mkdirp(path.dirname(cloneDir))
    log('dsh', `cloning ${MANIFEST.dshRepository}`)
    git(['clone', '--filter=blob:none', '--no-checkout', '--sparse', MANIFEST.dshRepository, cloneDir], {
      stdio: ['ignore', 'inherit', 'inherit'],
    })
  }
  const baseline = MANIFEST.baselines.B3
  git(['-C', cloneDir, 'sparse-checkout', 'set', '--skip-checks', ...baseline.sparseCheckout], {
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  git(['-C', cloneDir, 'checkout', '--detach', commit], { stdio: ['ignore', 'inherit', 'inherit'] })
  const head = git(['-C', cloneDir, 'rev-parse', 'HEAD']).trim()
  if (head !== commit) fail('dsh-clean', `clone HEAD ${head} != pinned ${commit}`)
  const dirty = git(['-C', cloneDir, 'status', '--porcelain']).trim()
  if (dirty !== '') fail('dsh-clean', `clone is dirty:\n${dirty}`)
  return cloneDir
}

function sourceBlobTable(cloneDir, commit) {
  const output = git(['-C', cloneDir, 'ls-tree', '-r', commit, '--', ...Object.values(DSH_DIR)])
  const table = {}
  for (const line of output.split('\n')) {
    if (!line.trim()) continue
    const match = /^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/.exec(line)
    if (!match) fail('dsh-blobs', `unparsable ls-tree line: ${line}`)
    const [, , type, sha, file] = match
    if (type !== 'blob') continue
    table[file] = sha
  }
  return table
}

function typesNodeDir() {
  const require = createRequire(path.join(REPO, 'packages/persistence/package.json'))
  return path.dirname(require.resolve('@types/node/package.json'))
}

/** Mirror the vendored package's own strictness overrides (they are part of its intended compilation). */
function vendoredOverrides(vendorDir) {
  const tsconfigPath = path.join(vendorDir, 'tsconfig.json')
  const raw = fs.readFileSync(tsconfigPath, 'utf8')
  const stripped = raw.replace(/^\s*\/\/.*$/gm, '')
  const parsed = JSON.parse(stripped)
  const keys = [
    'noImplicitAny',
    'noImplicitThis',
    'strictFunctionTypes',
    'noUncheckedIndexedAccess',
    'exactOptionalPropertyTypes',
    'noImplicitOverride',
    'noUnusedLocals',
    'noUnusedParameters',
  ]
  const overrides = {}
  for (const key of keys) {
    if (parsed.compilerOptions?.[key] !== undefined) overrides[key] = parsed.compilerOptions[key]
  }
  return overrides
}

function buildPackage(pkg, cloneDir, buildRoot, supportTypes) {
  const vendorDir = path.join(cloneDir, DSH_DIR[pkg])
  const srcDir = path.join(vendorDir, 'src')
  const buildDir = path.join(buildRoot, pkg)
  if (!fs.existsSync(srcDir)) fail('dsh-build', `missing vendored sources ${srcDir}`)
  rmrf(buildDir)
  mkdirp(path.join(buildDir, 'lib/types'))
  const paths = {}
  if (pkg === 'cordis' || pkg === 'timer') {
    paths['@deepseek-ai/cosmokit'] = [path.join(buildRoot, 'cosmokit/lib/types/index.d.ts')]
  }
  if (pkg === 'timer') {
    paths['@deepseek-ai/cordis'] = [path.join(buildRoot, 'cordis/lib/types/index.d.ts')]
  }
  if (pkg === 'cordis') {
    paths['@standard-schema/spec'] = [supportTypes]
  }
  const tsconfig = {
    compilerOptions: {
      target: 'ES2024',
      lib: ['ES2024'],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      ...vendoredOverrides(vendorDir),
      rootDir: srcDir,
      outDir: path.join(buildDir, 'lib'),
      declaration: true,
      declarationDir: path.join(buildDir, 'lib/types'),
      declarationMap: false,
      sourceMap: false,
      allowImportingTsExtensions: true,
      rewriteRelativeImportExtensions: true,
      strict: true,
      skipLibCheck: true,
      verbatimModuleSyntax: false,
      noEmitOnError: true,
      types: ['node'],
      typeRoots: [path.dirname(typesNodeDir())],
      ...(Object.keys(paths).length > 0 ? { baseUrl: buildDir, paths } : {}),
    },
    include: [path.join(srcDir, '**/*.ts')],
  }
  const tsconfigPath = path.join(buildDir, 'tsconfig.build.json')
  fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`)
  const tsc = path.join(REPO, 'node_modules/typescript/bin/tsc')
  try {
    execFileSync(process.execPath, [tsc, '-p', tsconfigPath], { stdio: ['ignore', 'inherit', 'inherit'] })
  } catch (error) {
    fail('dsh-build', `${pkg} tsc build failed (${error.message})`)
  }
  const libEntry = path.join(buildDir, 'lib/index.js')
  const typeEntry = path.join(buildDir, 'lib/types/index.d.ts')
  if (!fs.existsSync(libEntry)) fail('dsh-build', `${pkg} produced no lib/index.js`)
  if (!fs.existsSync(typeEntry)) fail('dsh-build', `${pkg} produced no lib/types/index.d.ts`)
  fs.copyFileSync(path.join(vendorDir, 'package.json'), path.join(buildDir, 'package.json'))
  return buildDir
}

function buildAll(cloneDir, supportTypes) {
  const buildRoot = path.join(CACHE, 'dsh/build')
  for (const pkg of BUILD_ORDER) buildPackage(pkg, cloneDir, buildRoot, supportTypes)
  return buildRoot
}

function outputTable(buildRoot) {
  const table = {}
  for (const pkg of BUILD_ORDER) {
    const buildDir = path.join(buildRoot, pkg)
    table[DSH_PACKAGE_NAME[pkg]] = {
      libTreeSha256: treeDigest(path.join(buildDir, 'lib')),
      libIndexSha256: sha256hex(fs.readFileSync(path.join(buildDir, 'lib/index.js'))),
      typesIndexSha256: sha256hex(fs.readFileSync(path.join(buildDir, 'lib/types/index.d.ts'))),
    }
  }
  return table
}

function buildRecipeRecord(buildRoot) {
  const recipe = {
    command: 'node <repo>/node_modules/typescript/bin/tsc -p <cache>/dsh/build/<pkg>/tsconfig.build.json',
    toolchain: {
      node: process.version,
      typescript: createRequire(path.join(REPO, 'package.json'))('typescript/package.json').version,
    },
    honestyNote:
      'minimal tsc source-build, NOT the official DSH `tsc -b` + tsdown pipeline (design §8.3 item 8 / SA6 §9.2). '
      + 'Package versions 4.1.0/1.2.0/1.9.0 are auxiliary metadata only and prove nothing about the Root API shape.',
    perPackage: Object.fromEntries(
      BUILD_ORDER.map((pkg) => {
        const tsconfigPath = path.join(buildRoot, pkg, 'tsconfig.build.json')
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'))
        return [
          DSH_PACKAGE_NAME[pkg],
          {
            vendoredPath: DSH_DIR[pkg],
            rootDir: 'src',
            outDir: 'lib',
            declaration: true,
            declarationDir: 'lib/types',
            allowImportingTsExtensions: true,
            rewriteRelativeImportExtensions: true,
            module: tsconfig.compilerOptions.module,
            moduleResolution: tsconfig.compilerOptions.moduleResolution,
            target: tsconfig.compilerOptions.target,
            paths: tsconfig.compilerOptions.paths ?? {},
          },
        ]
      }),
    ),
  }
  return recipe
}

async function acquireDshBaseline(overlayDir, options) {
  const commit = MANIFEST.baselines.B3.commit
  const cloneDir = ensureClone(commit)
  const blobs = sourceBlobTable(cloneDir, commit)
  // Support packages (declared dependency closure of the vendored artifact) are
  // extracted before the build so their pinned type declarations are available.
  for (const [name, spec] of Object.entries(MANIFEST.baselines.B3.support ?? {})) {
    const { bytes } = await ensureTarball(name, spec)
    extractPackage(bytes, overlayDir, name)
  }
  const supportTypes = path.join(
    overlayDir,
    'node_modules',
    '@standard-schema/spec/dist/index.d.ts',
  )
  if (!fs.existsSync(supportTypes)) fail('dsh-build', `missing support types ${supportTypes}`)
  const buildRoot = buildAll(cloneDir, supportTypes)
  const outputs = outputTable(buildRoot)
  const recipe = buildRecipeRecord(buildRoot)

  if (options.writeProvenance === true) {
    const record = {
      schemaVersion: 1,
      commit,
      repository: MANIFEST.dshRepository,
      sparseCheckout: MANIFEST.baselines.B3.sparseCheckout,
      cleanCheck: {
        command: `git -C <clone> rev-parse HEAD && git -C <clone> status --porcelain`,
        expectedHead: commit,
        expectedPorcelain: '',
      },
      buildRecipe: recipe,
      sourceBlobs: Object.fromEntries(Object.entries(blobs).sort(([a], [b]) => a.localeCompare(b))),
      outputs,
      crossChecks: {
        contextTs: blobs['vendor/cordis/src/context.ts'],
        utilsTs: blobs['vendor/cordis/src/utils.ts'],
        timerIndexTs: blobs['vendor/timer/src/index.ts'],
        cosmokitTypesTs: blobs['vendor/cosmokit/src/types.ts'],
      },
    }
    fs.writeFileSync(PROVENANCE_PATH, `${JSON.stringify(record, null, 2)}\n`)
    log('provenance', `wrote ${PROVENANCE_PATH}`)
  }

  if (!fs.existsSync(PROVENANCE_PATH)) {
    fail('provenance', `missing ${PROVENANCE_PATH}; run acquire.mjs --baseline B3 --write-provenance once`)
  }
  const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8'))
  if (provenance.commit !== commit) {
    fail('provenance', `provenance commit ${provenance.commit} != pinned ${commit}`)
  }
  const expectedBlobs = provenance.sourceBlobs ?? {}
  const actualPaths = Object.keys(blobs).sort()
  const expectedPaths = Object.keys(expectedBlobs).sort()
  if (actualPaths.length !== expectedPaths.length || actualPaths.some((file, i) => file !== expectedPaths[i])) {
    fail(
      'provenance',
      `vendored source file set drifted from provenance-b3.json (actual ${actualPaths.length}, expected ${expectedPaths.length})`,
    )
  }
  for (const file of actualPaths) {
    if (blobs[file] !== expectedBlobs[file]) {
      fail('provenance', `source blob mismatch ${file}: ls-tree ${blobs[file]} != provenance ${expectedBlobs[file]}`)
    }
  }
  for (const [name, expected] of Object.entries(provenance.outputs ?? {})) {
    const actual = outputs[name]
    if (actual === undefined) fail('provenance', `provenance lists output for ${name} but the build produced none`)
    for (const key of ['libTreeSha256', 'libIndexSha256', 'typesIndexSha256']) {
      if (actual[key] !== expected[key]) {
        fail('provenance', `output hash mismatch ${name}.${key}: build ${actual[key]} != provenance ${expected[key]}`)
      }
    }
  }

  // Materialize the overlay from the verified build outputs.
  for (const pkg of BUILD_ORDER) {
    const name = DSH_PACKAGE_NAME[pkg]
    const target = path.join(overlayDir, 'node_modules', ...name.split('/'))
    rmrf(target)
    mkdirp(path.dirname(target))
    fs.cpSync(path.join(buildRoot, pkg), target, { recursive: true })
  }
  return { overlayDir, provenanceDigest: sha256hex(Buffer.from(JSON.stringify(outputs), 'utf8')) }
}

// ---------------------------------------------------------------- entry

function parseArgs(argv) {
  const options = { baselines: [], writeProvenance: false, writeSurface: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--baseline') {
      const value = argv[++i]
      if (value === undefined) fail('usage', '--baseline requires a value')
      options.baselines.push(value)
    } else if (arg === '--all') {
      options.baselines = ['B1', 'B2', 'B3']
    } else if (arg === '--write-provenance') {
      options.writeProvenance = true
    } else {
      fail('usage', `unknown argument ${arg}`)
    }
  }
  if (options.baselines.length === 0) options.baselines = ['B1', 'B2', 'B3']
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const summary = {}
  for (const id of options.baselines) {
    const baseline = MANIFEST.baselines[id]
    if (baseline === undefined) fail('usage', `unknown baseline ${id} (expected B1|B2|B3)`)
    const overlayDir = path.join(CACHE, 'overlay', id)
    mkdirp(overlayDir)
    const result =
      baseline.kind === 'npm'
        ? await acquireNpmBaseline(baseline, overlayDir)
        : await acquireDshBaseline(overlayDir, options)
    summary[id] = {
      overlayDir: path.relative(REPO, overlayDir),
      packages: Object.fromEntries(
        Object.keys(baseline.packages).map((name) => {
          const manifest = JSON.parse(
            fs.readFileSync(path.join(overlayDir, 'node_modules', ...name.split('/'), 'package.json'), 'utf8'),
          )
          return [name, manifest.version]
        }),
      ),
      ...(result.provenanceDigest !== undefined ? { provenanceDigest: result.provenanceDigest } : {}),
    }
    log(id, `overlay ready at ${path.relative(REPO, overlayDir)}`)
  }
  console.log(JSON.stringify({ ok: true, baselines: summary }, null, 2))
}

await main()
