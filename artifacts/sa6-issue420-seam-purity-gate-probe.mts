/**
 * SA6 issue #420 —— AC4 证据：缝两侧只过 Uint8Array 与纯 JSON；包内零
 * worker_threads/MessageChannel/MessagePort 依赖或类型。
 *
 * 观察面：
 *  A. 结构门（当前即须绿、实现后须保持）：packages/ws-replication/{src,package.json} 内
 *     worker_threads / MessageChannel / MessagePort / node:worker_threads 命中数为 0。
 *  B. 纯 JSON 描述的运行时判据（验收可执行形态）：冻结描述子 structuredClone 深等；
 *     负控 = 描述子掺入函数闭包 → structuredClone 抛 DataCloneError（断言对「非纯 JSON」
 *     敏感，不是恒真）。
 *  C. 字节判据：缝上帧类断言 `frame instanceof Uint8Array`（占位编码帧为 Uint8Array）。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx artifacts/sa6-issue420-seam-purity-gate-probe.mts
 */
import { execFileSync } from 'node:child_process';
import { decodeMessage, encodeMessage } from '../packages/replication-protocol/src/index.ts';

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}

// A. 结构门：包内零 worker 依赖/类型
const pattern = 'worker_threads|MessageChannel|MessagePort';
const grepTargets = ['packages/ws-replication/src', 'packages/ws-replication/package.json'];
let grepHits: string;
try {
  grepHits = execFileSync('grep', ['-rnE', pattern, ...grepTargets], { encoding: 'utf8' });
} catch (err) {
  grepHits = (err as { status?: number }).stdout ?? '';
}
check('A.zeroWorkerApiReferences', grepHits.trim() === '', { grepHits: grepHits.trim(), targets: grepTargets });

// B. 纯 JSON 描述子判据（冻结形态）
const authorization = {
  ok: true as const,
  localOwner: { userId: 'hub-owner-9f38' },
  permissions: { read: true, submit: true },
};
const descriptor: Record<string, unknown> = {
  connectionKey: 'conn-key-1',
  remoteInstanceId: 'peer-omega',
  namespaceId: `ns-${'0'.repeat(31)}a`,
  authorization,
  selectedCapabilities: 0,
  connectionId: 'hub-omega-conn-0',
};
const cloned = structuredClone(descriptor);
check(
  'B.d1_descriptorIsPureJson',
  JSON.stringify(cloned) === JSON.stringify(descriptor) && Object.keys(cloned).length === 6,
  { keys: Object.keys(cloned).sort(), jsonEqual: JSON.stringify(cloned) === JSON.stringify(descriptor) },
);
let injectedError: string | undefined;
try {
  structuredClone({ ...descriptor, authorize: () => undefined });
} catch (err) {
  injectedError = (err as Error).name;
}
check('B.negativeControl_d2_functionBearingDescriptorRejected', injectedError === 'DataCloneError', {
  injectedError,
});

// C. 字节判据：占位编码帧是 Uint8Array（缝上唯一帧形态）
const placeholder = encodeMessage(
  { kind: 'SYNC_STEP1', namespaceId: `ns-${'0'.repeat(31)}a`, syncRoundId: 1, stateVector: new Uint8Array([0]) },
  { sequence: 0 },
);
const decoded = decodeMessage(placeholder);
check('C.framesAreUint8Array', placeholder instanceof Uint8Array && decoded.header.sequence === 0, {
  isUint8Array: placeholder instanceof Uint8Array,
  placeholderSequence: decoded.header.sequence,
});

const failed = results.filter((r) => !r.ok);
console.log(
  `PROBE_RESULT ${results.length - failed.length}/${results.length} passed; seam purity gate ${
    failed.length === 0 ? 'BASELINE GREEN (must remain after #420)' : 'PROBE SELF-FAILURE'
  }`,
);
if (failed.length > 0) process.exitCode = 1;
