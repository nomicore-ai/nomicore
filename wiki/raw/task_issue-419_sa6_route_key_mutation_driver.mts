/**
 * SA6 变异敏感性驱动 — issue #419（路由键布局守卫的断言敏感度因果实验）。
 *
 * 目的：证明契约断言（`task_issue-419_sa6_route_key_probe.mts` 的 P1–P4 / NC1–NC3）对三类
 * 布局漂移**逐个响亮失败**，且对无关改动**保持绿**（负控）。生产源码零改动：
 * 每次变异把 `packages/replication-protocol/src` 复制到 `.scratch/sa6-419/mutants/<id>/src`，
 * 只在副本上打补丁，再用 `SA6_CODEC_SRC` 指向副本运行探针；运行后删除副本。
 *
 * 运行：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     wiki/raw/task_issue-419_sa6_route_key_mutation_driver.mts
 *
 * 退出码：0 = 全部变异达到预期（含“无关变异保持全绿”），1 = 期望与实测不符。
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SRC_DIR = join(REPO, 'packages/replication-protocol/src');
const PROBE = fileURLToPath(new URL('./task_issue-419_sa6_route_key_probe.mts', import.meta.url));
const SCRATCH_ROOT = join(REPO, '.scratch/sa6-419');
const MUTANT_ROOT = join(SCRATCH_ROOT, 'mutants');

/** 删除变异副本：先摘除 node_modules 符号链接（绝不递归进真实包依赖目录），再删目录。 */
function removeMutantDir(dir: string): void {
  const link = join(dir, 'node_modules');
  try {
    if (lstatSync(link).isSymbolicLink()) unlinkSync(link);
  } catch {
    /* 符号链接不存在 */
  }
  rmSync(dir, { recursive: true, force: true });
}

interface Mutation {
  /** 变异 id。 */
  readonly id: string;
  /** 被测源码文件（相对 src/）。 */
  readonly file: string;
  /** 施加的漂移。 */
  readonly note: string;
  /** 精确锚点 → 替换（生产源码原样拷贝后单点替换）。 */
  readonly from: string;
  readonly to: string;
  /** 期望被点亮的 FAIL id（升序）。 */
  readonly expectFail: string[];
  /** 期望失败详情中必须出现的证据子串（逐个不得缺失）。 */
  readonly expectDetail: string[];
}

const MUTATIONS: readonly Mutation[] = [
  {
    id: 'M1-domain-field-order',
    file: 'payloads.ts',
    note: 'RESYNC_REQUIRED：reasonCode 写到 namespaceId 之前（namespace 域字段序漂移）',
    from: `function encodeResyncRequired(writer: PayloadWriter, msg: ResyncRequiredMsg): void {
  checkNamespaceId(msg.namespaceId);
  checkNonEmpty(msg.reasonCode, 'reasonCode');
  writer.writeVarString(msg.namespaceId, 'namespaceId');
  writer.writeVarString(msg.reasonCode, 'reasonCode');
}`,
    to: `function encodeResyncRequired(writer: PayloadWriter, msg: ResyncRequiredMsg): void {
  checkNamespaceId(msg.namespaceId);
  checkNonEmpty(msg.reasonCode, 'reasonCode');
  writer.writeVarString(msg.reasonCode, 'reasonCode');
  writer.writeVarString(msg.namespaceId, 'namespaceId');
}`,
    expectFail: ['P1.domain-fixed-offset', 'P4.differential-window'],
    expectDetail: ['RESYNC_REQUIRED: prefix@20', 'RESYNC_REQUIRED: 差分值域起点'],
  },
  {
    id: 'M2-chunk-kind-order',
    file: 'payloads.ts',
    note: 'UPDATE_CHUNK：namespaceId 写到 kind 之前（kind 首字段漂移）',
    from: `  writer.writeVarUint(transferKind, 'transferKind');
  writer.writeVarString(msg.namespaceId, 'namespaceId');`,
    to: `  writer.writeVarString(msg.namespaceId, 'namespaceId');
  writer.writeVarUint(transferKind, 'transferKind');`,
    expectFail: ['NC2.registry-scope-partition', 'P2.update-chunk-kind-first', 'P4.differential-window'],
    expectDetail: ['kind0/first: kind@20', 'UPDATE_CHUNK/kind0: 差分值域起点', 'UPDATE_CHUNK 首字节是 kind'],
  },
  {
    id: 'M3-error-field-order',
    file: 'payloads.ts',
    note: 'ERROR：namespaceId 块写到 relatedSequence 块之前（ERROR 字段序漂移）',
    from: `  if (msg.relatedSequence !== undefined) {
    writer.writeU8(1);
    writer.writeVarUint32(msg.relatedSequence, 'relatedSequence');
  } else {
    writer.writeU8(0);
  }
  if (msg.namespaceId !== undefined) {
    writer.writeU8(1);
    writer.writeVarString(msg.namespaceId, 'namespaceId');
  } else {
    writer.writeU8(0);
  }`,
    to: `  if (msg.namespaceId !== undefined) {
    writer.writeU8(1);
    writer.writeVarString(msg.namespaceId, 'namespaceId');
  } else {
    writer.writeU8(0);
  }
  if (msg.relatedSequence !== undefined) {
    writer.writeU8(1);
    writer.writeVarUint32(msg.relatedSequence, 'relatedSequence');
  } else {
    writer.writeU8(0);
  }`,
    expectFail: ['P3.error-field-order'],
    expectDetail: ['conn/related: namespaceId 值长度 ≠ 35'],
  },
  {
    id: 'M4-domain-leading-field',
    file: 'payloads.ts',
    note: 'UPDATE：namespaceId 之前插入新前导字段（定偏移整体位移 1 字节）',
    from: `function encodeUpdate(writer: PayloadWriter, msg: UpdateMsg, limits: FieldLimits | undefined): void {
  checkNamespaceId(msg.namespaceId);`,
    to: `function encodeUpdate(writer: PayloadWriter, msg: UpdateMsg, limits: FieldLimits | undefined): void {
  checkNamespaceId(msg.namespaceId);
  writer.writeVarUint(0, 'routePad');`,
    expectFail: ['P1.domain-fixed-offset', 'P4.differential-window'],
    expectDetail: ['UPDATE: prefix@20', 'UPDATE: 差分值域起点'],
  },
  {
    id: 'NM1-neutral-refactor',
    file: 'payloads.ts',
    note: '负控：SYNC_APPLIED 的 ackedSequence 从 writeVarUint32 改为等价 writeVarUint（字节恒等，探针必须全绿）',
    from: `  writer.writeVarUint32(msg.syncRoundId, 'syncRoundId');
  writer.writeVarUint32(msg.ackedSequence, 'ackedSequence');`,
    to: `  writer.writeVarUint32(msg.syncRoundId, 'syncRoundId');
  writer.writeVarUint(msg.ackedSequence, 'ackedSequence');`,
    expectFail: [],
    expectDetail: [],
  },
  {
    id: 'NM2-connection-value-change',
    file: 'payloads.ts',
    note: '负控：GOAWAY（连接级）drainTimeoutMs 值改变——路由键布局不动，探针必须全绿（守卫不得越界到连接级语义）',
    from: `  writer.writeVarString(msg.reasonCode, 'reasonCode');
  writer.writeVarUint(msg.drainTimeoutMs, 'drainTimeoutMs');`,
    to: `  writer.writeVarString(msg.reasonCode, 'reasonCode');
  writer.writeVarUint(msg.drainTimeoutMs + 1, 'drainTimeoutMs');`,
    expectFail: [],
    expectDetail: [],
  },
];

interface ProbeRun {
  readonly code: number;
  readonly stdout: string;
  readonly failedIds: string[];
  readonly resultLine: string;
}

function runProbe(codecIndex: string): ProbeRun {
  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync('pnpm', ['exec', 'tsx', PROBE], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--conditions=nomicore-source', SA6_CODEC_SRC: codecIndex },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    code = err.status ?? 1;
    stdout = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  const resultLine = stdout.split('\n').find((l) => l.startsWith('RESULT ')) ?? '';
  const m = /FAILED_IDS=([^ ]+)/.exec(resultLine);
  return { code, stdout, failedIds: m ? m[1]!.split(',') : [], resultLine };
}

let mismatches = 0;
console.log(`probe=${relative(REPO, PROBE)}  src=${relative(REPO, SRC_DIR)}`);
for (const mutation of MUTATIONS) {
  if (existsSync(MUTANT_ROOT) === false) mkdirSync(MUTANT_ROOT, { recursive: true });
  const dir = mkdtempSync(join(MUTANT_ROOT, `${mutation.id}-`));
  cpSync(SRC_DIR, join(dir, 'src'), { recursive: true });
  // 让副本内的裸依赖（lib0/yjs/y-protocols）经包内 node_modules 解析；不改动真实包目录。
  symlinkSync(join(REPO, 'packages/replication-protocol/node_modules'), join(dir, 'node_modules'), 'dir');
  const target = join(dir, 'src', mutation.file);
  const text = readFileSync(target, 'utf8');
  const occurrences = text.split(mutation.from).length - 1;
  if (occurrences !== 1) {
    console.log(`SETUP-FAIL ${mutation.id} :: 锚点在 ${mutation.file} 命中 ${occurrences} 次（要求恰 1 次）`);
    removeMutantDir(dir);
    mismatches++;
    continue;
  }
  writeFileSync(target, text.replace(mutation.from, mutation.to));
  const run = runProbe(join(dir, 'src/index.ts'));
  const got = [...run.failedIds].sort();
  const want = [...mutation.expectFail].sort();
  const idsOk = JSON.stringify(got) === JSON.stringify(want);
  const detailMissing = mutation.expectDetail.filter((d) => !run.stdout.includes(d));
  const exitOk = mutation.expectFail.length === 0 ? run.code === 0 : run.code !== 0;
  const ok = idsOk && detailMissing.length === 0 && exitOk;
  if (!ok) mismatches++;
  console.log(
    `${ok ? 'EXPECTED' : 'UNEXPECTED'} ${mutation.id} :: ${mutation.note}\n` +
      `    exit=${run.code} failed=[${got.join(',')}] expected=[${want.join(',')}]` +
      (detailMissing.length ? ` missingDetail=${JSON.stringify(detailMissing)}` : '') +
      (mutation.expectFail.length === 0 ? ' (负控：必须保持全绿)' : ''),
  );
  for (const line of run.stdout.split('\n').filter((l) => l.startsWith('FAIL '))) {
    console.log(`    ${line}`);
  }
  removeMutantDir(dir);
}
// 收尾：删除本 SA6 专用 scratch 根（只含本次变异副本；不含仓内既有 .scratch 内容）
rmSync(SCRATCH_ROOT, { recursive: true, force: true });
console.log(`MUTATION_RESULT ${MUTATIONS.length - mismatches}/${MUTATIONS.length} expected`);
process.exitCode = mismatches ? 1 : 0;
