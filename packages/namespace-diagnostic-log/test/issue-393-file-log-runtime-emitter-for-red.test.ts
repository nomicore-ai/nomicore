/**
 * SA6 验收契约（适配器边界）— issue #393 P0：`FileDiagnosticLog` 自绑定
 * `runtimeEmitterFor(namespaceId)`（identity 匹配本 namespace 的 public 成员）。
 *
 * 契约来源：`wiki/raw/task_issue-393.md` P0 决策文本（维护者 comment 5664521867）：
 * - 成员形状：`runtimeEmitterFor(namespaceId: string): NamespaceDiagnosticChangeEmitter | undefined`；
 * - 实现语义 = `ns === this.namespaceId ? emitter : undefined`；
 * - **不加 `initStream`**（泵路径对缺席成员已有 no-op 语义；stream 构造期已 eager
 *   建立，resume 路径照常）；
 * - registry 侧探测逻辑零改动（`create-diagnostic.ts` 非抛读取既有成员名）。
 *
 * 红灯核心（当前 HEAD = dcb3766）：`FileDiagnosticLog` 接口/产物无该成员 →
 * `typeof log.runtimeEmitterFor === 'undefined'` → registry `createDiagRuntime` 落入
 * #150 legacy 回落 → 该 ns 的 runtime 级 emission 从不产生（端到端证据见
 * `packages/namespace-registry/test/issue-393-ndcl-self-binding-red.test.ts`）。
 *
 * 断言面 = 适配器公共行为（成员在场性、identity 同一性、返回 emitter 的真实落盘、
 * resume 路径一致性、`initStream` 缺席守卫）——零源码字符串断言。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readStreamStrict, type FileDiagnosticLog } from '../src/index.js';
import { baseEmission } from './helpers/base.js';
import { makeFileLog, makeTempRoot, rmTempRoot } from './helpers/file.js';

const NS = 'ns-00000000000000000000000000000001';
const OTHER_NS = 'ns-00000000000000000000000000000002';
const NOW_MS = 1_700_000_000_000;

const roots: string[] = [];
function freshRoot(prefix: string): string {
  const root = makeTempRoot(prefix);
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmTempRoot(root);
});

function makeLog(rootDir: string, namespaceId: string, resumeStreamId?: string): FileDiagnosticLog {
  return makeFileLog({
    rootDir,
    namespaceId,
    clock: { now: () => NOW_MS },
    ...(resumeStreamId !== undefined ? { resumeStreamId } : {}),
  }).log;
}

/** 非抛读取 P0 契约成员（缺席 = 当前红灯；断言先行，无级联 TypeError）。 */
function requireRuntimeEmitterFor(log: FileDiagnosticLog): (namespaceId: string) => unknown {
  const member = (log as unknown as { runtimeEmitterFor?: unknown }).runtimeEmitterFor;
  expect(
    typeof member,
    'P0：FileDiagnosticLog 必须自带 runtimeEmitterFor（identity 匹配本 namespace）',
  ).toBe('function');
  if (typeof member !== 'function') throw new Error('unreachable after assertion');
  return member as (namespaceId: string) => unknown;
}

interface AttemptView {
  readonly operation: string | undefined;
  readonly sequence: string | undefined;
  readonly resultKind: string | undefined;
}

function readAttempts(rootDir: string, namespaceId: string, streamId: string): AttemptView[] {
  const read = readStreamStrict({ rootDir, namespaceId, streamId });
  expect(read.status, `strict reader 读取失败：${JSON.stringify(read)}`).toBe('ok');
  return read.records
    .filter((entry) => entry.ok && entry.record !== null)
    .map((entry) => entry.record as unknown as Record<string, unknown>)
    .filter((record) => record.recordKind === 'attempt')
    .map((record) => ({
      operation: typeof record.operation === 'string' ? record.operation : undefined,
      sequence: typeof record.sequence === 'string' ? record.sequence : undefined,
      resultKind:
        record.result !== null && typeof record.result === 'object'
          ? ((record.result as { kind?: unknown }).kind as string | undefined)
          : undefined,
    }));
}

describe('#393 P0（适配器边界）— FileDiagnosticLog.runtimeEmitterFor 自绑定', () => {
  it('R1 (RED): 成员在场 + identity 匹配本 ns + 其它 ns 解析 undefined', () => {
    const rootDir = freshRoot('issue393-ndcl-r1-');
    const log = makeLog(rootDir, NS);
    const resolver = requireRuntimeEmitterFor(log);
    expect(resolver(NS), 'identity 匹配必须返回同一 emitter 实例').toBe(log.emitter);
    expect(resolver(OTHER_NS), '非本 ns 必须解析 undefined（泵内丢弃，杜绝跨 ns 写错流）').toBeUndefined();
  });

  it('R2 (RED): 解析所得 emitter 是该流的真实写面——emit 落盘', () => {
    const rootDir = freshRoot('issue393-ndcl-r2-');
    const log = makeLog(rootDir, NS);
    const resolver = requireRuntimeEmitterFor(log) as (namespaceId: string) => {
      emit(emission: unknown): void;
    } | undefined;
    const emitter = resolver(NS);
    expect(emitter, '本 ns 解析必须非 undefined').toBeDefined();
    if (emitter === undefined) throw new Error('unreachable after assertion');
    emitter.emit(baseEmission({ observedAt: new Date(NOW_MS).toISOString() }));

    const attempts = readAttempts(rootDir, NS, log.streamId);
    expect(attempts.some((record) => record.operation === 'root-mutation')).toBe(true);
  });

  it('R3 (RED): resume 路径自绑定不变——续写同一 stream 的 log 同样 identity 匹配', () => {
    const rootDir = freshRoot('issue393-ndcl-r3-');
    const first = makeLog(rootDir, NS);
    first.emitter.emit(baseEmission({ observedAt: new Date(NOW_MS).toISOString() }));
    const second = makeLog(rootDir, NS, first.streamId);
    expect(second.streamId).toBe(first.streamId);

    const resolver = requireRuntimeEmitterFor(second);
    expect(resolver(NS), 'resume 构造的 log 必须同样自绑定').toBe(second.emitter);
    expect(resolver(OTHER_NS)).toBeUndefined();

    const seenBefore = readAttempts(rootDir, NS, second.streamId).length;
    second.emitter.emit(
      baseEmission({ observedAt: new Date(NOW_MS).toISOString(), attemptId: '0193resume0000000000000000000001' }),
    );
    const seenAfter = readAttempts(rootDir, NS, second.streamId);
    expect(seenAfter.length).toBe(seenBefore + 1);
  });

  it('G1 (GREEN): 不新增 initStream 成员（P0 明文纪律）', () => {
    const rootDir = freshRoot('issue393-ndcl-g1-');
    const log = makeLog(rootDir, NS);
    expect((log as unknown as Record<string, unknown>).initStream).toBeUndefined();
  });

  it('G2 (GREEN): emitter 成员语义零漂移——直发仍落盘（identity 返回值即此实例）', () => {
    const rootDir = freshRoot('issue393-ndcl-g2-');
    const log = makeLog(rootDir, NS);
    log.emitter.emit(baseEmission({ observedAt: new Date(NOW_MS).toISOString() }));
    const attempts = readAttempts(rootDir, NS, log.streamId);
    expect(attempts.length).toBeGreaterThanOrEqual(1);
    expect(attempts[0]!.resultKind).toBe('committed');
  });
});
