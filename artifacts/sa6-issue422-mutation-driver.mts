/**
 * SA6 变异敏感性驱动 — issue #422（`listen: false` 免 listen 模式 + SessionHost 服务）。
 *
 * 目的：证明能力缺口探针（`artifacts/sa6-issue422-capability-gap-probe.mts`）的断言**不是恒真**：
 *   - 变异 M1（falsy 陷阱）：`!config.listen` 静默降级 → NC-3 的伪值形态（0/''/null/undefined/NaN）
 *     必须点名失败（「拼写/伪值不得静默降级为免 listen」的敏感性锚）；
 *   - 变异 M2（去掉 listen 模式认证要求）→ NC-4b 必须失败（listen 模式校验面回归锚）；
 *   - 变异 M3（去掉 listen adapter 要求）→ NC-4a 必须失败；
 *   - 等价改写 NM1（`=== undefined` → `== null`）→ 失败集必须与 HEAD **零变化**（探针只锁行为）。
 *
 * 纪律：`packages/**` 零写入——副本落 `.scratch/sa6-422/mutants/<id>/src`（仅 symlink 包内
 * `node_modules`），运行后整目录删除；每个变异替换串必须恰好命中 1 次（否则 ABORT）。
 *
 * 运行：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     artifacts/sa6-issue422-mutation-driver.mts
 * 期望：末行 `MUTATION_RESULT 4/4 expected`，exit 0。
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PKG = join(REPO, 'packages', 'ws-replication');
const PROBE = join(HERE, 'sa6-issue422-capability-gap-probe.mts');
const SCRATCH = join(REPO, '.scratch', 'sa6-422');

/** HEAD 基线失败集（能力缺口：目标面全缺 + listen 形态要求链保持）。 */
const HEAD_FAIL = [
  'CAP-12-public-entry-service-name-and-require-helper',
  'CAP-1-listen-false-constructs-without-throw',
  'CAP-2-session-host-service-published',
  'CAP-3-service-status-ready-zero-sessions',
  'CAP-4-service-open-real-session-open-ok',
  'CAP-5-session-uses-context-registry-projection',
  'CAP-6-session-uses-injected-observer',
  'CAP-7-session-uses-context-timer',
  'CAP-8-no-hub-replication-service',
  'CAP-9-plugin-replication-and-listener-undefined',
  'CAP-10-supplied-listener-adapter-never-called',
  'CAP-11-teardown-sessions-closed-timers-cleared',
  'CAP-13-require-helper-roundtrip-and-revoke',
];

interface Mutant {
  readonly id: string;
  readonly drift: string;
  readonly file: 'plugin.ts';
  readonly find: string;
  readonly replace: string;
  readonly expectFail: readonly string[];
}

/** listen 形态两段校验（assertRecord + 字段域）——M1 只跳过这两段（其余校验链原样）。 */
const LISTEN_SHAPE_VALIDATION = `  assertRecord(config.listen, 'hub replication listen', new Set(['host', 'port', 'path']));
  if (typeof config.listen.host !== 'string' || config.listen.host.length === 0
    || !Number.isInteger(config.listen.port) || config.listen.port < 0 || config.listen.port > 65535
    || (config.listen.path !== undefined && (typeof config.listen.path !== 'string' || !config.listen.path.startsWith('/')))) {
    throw new TypeError('hub replication config: invalid listen settings');
  }`;

/** M1：falsy 陷阱——0/''/null/undefined/NaN 被当作免 listen（其余校验链不动）。 */
const FALSY_TRAP_REPLACEMENT = `  if (!config.listen) {
    // MUTANT(M1) falsy trap：伪值静默降级为免 listen（其余校验链原样保留）。
  } else {
${LISTEN_SHAPE_VALIDATION.replace(/^/gm, '  ')}
  }`;

const FALSY_NC3B_FAIL = [
  'NC-3b-invalid-listen-with-full-overrides-number-0',
  'NC-3b-invalid-listen-with-full-overrides-empty-string',
  'NC-3b-invalid-listen-with-full-overrides-null',
  'NC-3b-invalid-listen-with-full-overrides-undefined-value',
  'NC-3b-invalid-listen-with-full-overrides-nan',
];

const MUTANTS: readonly Mutant[] = [
  {
    id: 'M1-falsy-trap-silent-downgrade',
    drift: "`!config.listen` 静默降级：0/''/null/undefined/NaN 被当作免 listen（拼写/伪值不得静默降级）",
    file: 'plugin.ts',
    find: LISTEN_SHAPE_VALIDATION,
    replace: FALSY_TRAP_REPLACEMENT,
    expectFail: [...HEAD_FAIL, ...FALSY_NC3B_FAIL],
  },
  {
    id: 'M2-authentication-requirement-removed',
    drift: 'listen 模式去掉「认证必需」校验（装配校验面漂移）',
    file: 'plugin.ts',
    find: "  if (overrides.verifyToken === undefined && tokens === undefined) throw new TypeError('hub replication config: authentication is required');\n",
    replace: '',
    expectFail: [...HEAD_FAIL, 'NC-4b-authentication-required'],
  },
  {
    id: 'M3-listen-adapter-requirement-removed',
    drift: 'listen 模式去掉「listen adapter 必需」校验（listen 装配面漂移）',
    file: 'plugin.ts',
    find: "  if (overrides.listen === undefined) throw new TypeError('hub replication config: listen adapter is required');\n",
    replace: '',
    expectFail: [...HEAD_FAIL, 'NC-4a-listen-adapter-required'],
  },
  {
    id: 'NM1-equivalent-null-check-rewrite',
    drift: '等价改写：`overrides.listen === undefined` → `overrides.listen == null`（行为等价，探针不得变红）',
    file: 'plugin.ts',
    find: '  if (overrides.listen === undefined) throw new TypeError(',
    replace: '  if (overrides.listen == null) throw new TypeError(',
    expectFail: HEAD_FAIL,
  },
];

mkdirSync(SCRATCH, { recursive: true });
const outcomes: Array<{ id: string; ok: boolean; expected: string[]; actual: string[] }> = [];

for (const mutant of MUTANTS) {
  const root = join(SCRATCH, 'mutants', mutant.id);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'src'), { recursive: true });
  cpSync(join(PKG, 'src'), join(root, 'src'), { recursive: true });
  symlinkSync(join(PKG, 'node_modules'), join(root, 'node_modules'), 'dir');
  const target = join(root, 'src', mutant.file);
  const text = readFileSync(target, 'utf8');
  const hits = text.split(mutant.find).length - 1;
  if (hits !== 1) {
    console.log(`ABORT ${mutant.id} 替换串命中 ${hits} 次（期望 1）`);
    process.exitCode = 2;
    break;
  }
  writeFileSync(target, text.replace(mutant.find, mutant.replace));

  const run = spawnSync('pnpm', ['exec', 'tsx', PROBE], {
    cwd: REPO,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: '--conditions=nomicore-source',
      SA6_PLUGIN_SRC: pathToFileURL(join(root, 'src', 'plugin.ts')).href,
      SA6_INDEX_SRC: pathToFileURL(join(root, 'src', 'index.ts')).href,
      SA6_EXPECT_FAIL: mutant.expectFail.join(','),
    },
  });
  const stdout = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  const actualLine = stdout.split('\n').find((line) => line.startsWith('ACTUAL_FAIL'));
  const actual = actualLine === undefined ? [] : actualLine.replace('ACTUAL_FAIL', '').trim().split(',').filter(Boolean);
  const match = stdout.includes('MUTATION_MATCH yes');
  const expected = [...mutant.expectFail].sort();
  const ok = match && JSON.stringify(expected) === JSON.stringify([...actual].sort());
  outcomes.push({ id: mutant.id, ok, expected, actual });
  console.log(
    `${ok ? 'OK  ' : 'BAD '}${mutant.id.padEnd(38)} expected=[${expected.join(',')}] actual=[${[...actual].sort().join(',')}] exit=${String(run.status)}`,
  );
  console.log(`     drift: ${mutant.drift}`);
}

rmSync(SCRATCH, { recursive: true, force: true });
const okCount = outcomes.filter((outcome) => outcome.ok).length;
console.log(`MUTATION_RESULT ${okCount}/${MUTANTS.length} expected`);
process.exitCode = okCount === MUTANTS.length ? 0 : 1;
