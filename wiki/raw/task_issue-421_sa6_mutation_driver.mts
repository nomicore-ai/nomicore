/**
 * SA6 变异敏感性驱动 — issue #421（spec #415 T4）。
 *
 * 目的：证明契约探针（`task_issue-421_sa6_capability_probe.mts`）的 ORACLE/NC 断言**不是恒真**
 * ——把生产源码副本单点变异（对照语义漂移）后，对应断言必须点名失败；与契约无关的等价改写
 * 必须保持全绿（断言面只锁行为、不锁实现写法）。
 *
 * 纪律：
 * - **真实 `packages/**` 零写入**：副本落在 `.scratch/sa6-421/mutants/<id>/src`，仅 symlink
 *   包内 `node_modules`（bare import 解析用），运行后整目录删除；
 * - 每个变异只改一处（替换串必须恰好命中 1 次，否则 ABORT）；
 * - 期望失败集与实测失败集**逐项相等**才算符合（多红/少红都判该变异不符）。
 *
 * 运行：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-421_sa6_mutation_driver.mts
 * 期望：末行 `MUTATION_RESULT 7/7 expected`，exit 0。
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { strict as assert } from 'node:assert';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const PKG = join(REPO, 'packages', 'ws-replication');
const PROBE = join(HERE, 'task_issue-421_sa6_capability_probe.mts');
const SCRATCH = join(REPO, '.scratch', 'sa6-421');
const MUTANT_ROOT = join(SCRATCH, 'mutants');

interface Mutant {
  readonly id: string;
  /** 语义漂移的一句话描述（报告 §9 表用）。 */
  readonly drift: string;
  readonly file: 'hub-edge.ts' | 'frame-io.ts';
  readonly find: string;
  readonly replace: string;
  readonly expectFail: readonly string[];
}

const MUTANTS: readonly Mutant[] = [
  {
    id: 'M1-route-key-domain-offset',
    drift: '路由键定偏移读取右移 1 字节（namespace 域帧 [21..56) → [22..57)）',
    file: 'hub-edge.ts',
    find: '    const start = isChunk ? 22 : 21;',
    replace: '    const start = isChunk ? 22 : 22;',
    expectFail: ['G5', 'NC1', 'NC4', 'O2', 'O2b', 'O5b'],
  },
  {
    id: 'M2-connection-error-broadcast',
    drift: '连接级 ERROR 广播到 session 半边（去掉「无 nsId 不路由」早退）',
    file: 'hub-edge.ts',
    find: '        if (message.namespaceId === undefined) return;\n        if (!this.admissions.has(message.namespaceId)) return;',
    replace: '        if (message.namespaceId === undefined) {\n          this.sink.namespaceFrame(message, sequence);\n          return;\n        }\n        if (!this.admissions.has(message.namespaceId)) return;',
    expectFail: ['O3'],
  },
  {
    id: 'M3-stamp-no-increment',
    drift: '出站盖章不再严格递增（每帧恒盖 sequence=1）',
    file: 'frame-io.ts',
    find: '    const sequence = this.lastSeq + 1;',
    replace: '    const sequence = 1;',
    expectFail: ['NC2', 'O1b', 'O2b', 'O5', 'O5b'],
  },
  {
    id: 'M4-no-sink-silent-drop',
    drift: '合法无 sink 帧静默丢弃（去掉合成 NAMESPACE_STATE_VIOLATION）',
    file: 'hub-edge.ts',
    find: '          this.synthesizeNamespaceStateViolation(namespaceId); // R-none（逐符号迁移 withChannel 未知 ns 分支）',
    replace: '          return; // MUTANT: R-none 静默丢弃',
    expectFail: ['NC4', 'O2', 'O2b', 'O5b'],
  },
  {
    id: 'M5-drain-gate-removed',
    drift: 'drain 门失效（REAUTH_REQUIRED 窗口内新 OPEN 继续进入 session）',
    file: 'hub-edge.ts',
    find: "        case 'OPEN_NAMESPACE':\n          // REAUTH_REQUIRED 窗口零响应，避免认证失效后泄露 namespace 观测。\n          return;",
    replace: "        case 'OPEN_NAMESPACE':\n          // MUTANT: drain 门移除\n          break;",
    expectFail: ['O6'],
  },
  {
    id: 'NM1-ascii-at-equivalent-rewrite',
    drift: '中性等价改写：asciiAt 循环 → Array.from/join（字节恒等）',
    file: 'hub-edge.ts',
    find: "  let out = '';\n  for (let index = start; index < end; index += 1) out += String.fromCharCode(bytes[index]!);\n  return out;",
    replace: '  return Array.from(bytes.subarray(start, end), (byte) => String.fromCharCode(byte)).join(\'\');',
    expectFail: [],
  },
  {
    id: 'NM2-routing-key-statement-reorder',
    drift: '中性等价改写：routingKeyOf 内语句重排 + 显式比较（行为不变）',
    file: 'hub-edge.ts',
    find: "    const decoded = 'namespaceId' in message ? message.namespaceId : undefined;\n    return key === decoded ? key : undefined;",
    replace: "    const fromDecoded = 'namespaceId' in message ? message.namespaceId : undefined;\n    if (key !== fromDecoded) return undefined;\n    return key;",
    expectFail: [],
  },
];

function patch(file: string, find: string, replace: string): void {
  const text = readFileSync(file, 'utf8');
  const occurrences = text.split(find).length - 1;
  assert.equal(occurrences, 1, `替换串须恰好命中 1 次：${file}（实测 ${occurrences}）`);
  writeFileSync(file, text.replace(find, replace), 'utf8');
}

function runProbe(edgeSrc: string, expectFail: readonly string[]): {
  exitCode: number;
  actualFail: string[];
  stdout: string;
} {
  const result = spawnSync(
    'pnpm',
    ['exec', 'tsx', PROBE],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_OPTIONS: '--conditions=nomicore-source',
        SA6_EDGE_SRC: `file://${edgeSrc}`,
        SA6_EXPECT_FAIL: expectFail.join(','),
      },
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  const stdout = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const match = /MUTATION_RESULT actual_fail=\[([^\]]*)\] expected_fail=\[([^\]]*)\]/.exec(stdout);
  assert.ok(match, `${edgeSrc}: 未产出 MUTATION_RESULT 行`);
  const actualFail = match[1]!.split(',').map((id) => id.trim()).filter((id) => id.length > 0).sort();
  return { exitCode: result.status ?? -1, actualFail, stdout };
}

// ═══════════════════════════ 运行矩阵 ═══════════════════════════

mkdirSync(MUTANT_ROOT, { recursive: true });
const rows: string[] = [];
let conforming = 0;

for (const mutant of MUTANTS) {
  const dir = join(MUTANT_ROOT, mutant.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(join(PKG, 'src'), join(dir, 'src'), { recursive: true });
  const nm = join(PKG, 'node_modules');
  if (existsSync(nm)) symlinkSync(nm, join(dir, 'node_modules'), 'dir');
  patch(join(dir, 'src', mutant.file), mutant.find, mutant.replace);

  const { actualFail } = runProbe(join(dir, 'src', 'hub-edge.ts'), mutant.expectFail);
  const expected = [...mutant.expectFail].sort();
  const ok = actualFail.join(',') === expected.join(',');
  if (ok) conforming += 1;
  rows.push(
    `${ok ? 'OK  ' : 'FAIL'} ${mutant.id.padEnd(34)} expected=[${expected.join(',')}] actual=[${actualFail.join(',')}]`,
  );
  rmSync(dir, { recursive: true, force: true });
}

for (const row of rows) console.log(row);
rmSync(MUTANT_ROOT, { recursive: true, force: true });
console.log(`MUTATION_RESULT ${conforming}/${MUTANTS.length} expected`);
process.exitCode = conforming === MUTANTS.length ? 0 : 1;
