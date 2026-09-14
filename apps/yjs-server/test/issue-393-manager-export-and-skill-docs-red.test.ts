/**
 * SA6 验收契约 — issue #393 P1（`@nomicore/yjs-server` 导出泛化 manager）与
 * P2（skill 诊断日志配置节 + 路由）接受面。
 *
 * 契约来源：`wiki/raw/task_issue-393.md`：
 * - P1：`apps/yjs-server/src/diagnostics.ts` 的 `createHostDiagnosticsManager` 泛化签名后
 *   从 `index.ts` 导出（摆脱 app 本地类型 `DiagnosticsConfig` 的 `enabled` 标志与
 *   `EventSink` 的 stdout 语义；sink 泛化为 `onEvent?: (e) => void`、钟泛化为
 *   `now: () => number`）；app 内部消费同一导出（全仓该逻辑仅一份）。
 * - P2：`.agents/skills/nomicore/cordis-host.md` 新增诊断日志配置节（单 ns 直接传
 *   `createFileDiagnosticLog(...)` 产物；多 ns 用导出的 manager；裸 `{emitter}` =
 *   仅 create 尝试的 legacy 陷阱说明；Hub/Peer 组合根示例），`SKILL.md` 路由行同步。
 *
 * 契约分类（当前 HEAD = dcb3766）：
 * - P1-R1/R2/R3/R4 —— **红灯**（导出缺席期统一红）：`createHostDiagnosticsManager`
 *   不在公共入口（`apps/yjs-server/src/index.ts`）导出；泛化签名（`{ onEvent, now }`）
 *   不可用；R4 为 retirement 语义守护（导出落地后必须绿——迟到解析恒
 *   `namespace-deleted` 丢弃桩，与 P0 单 ns 自绑定的「接受落盘」判决互补，边界见下）。
 * - P2-R1/P2-R2 —— **红灯**：skill 文档尚无配置节 / 路由行。
 *
 * P0/P1 语义边界（写死在契约里）：单 ns 部署直传 `createFileDiagnosticLog(...)` 产物
 * = P0 正路（无归属公共入口拒绝落本流 = 接受落盘）；多 ns Host 的正路 = 本文件锚定的
 * manager 导出，其共享 `emitter` 保持 `unattributed` 丢弃 + 计数。
 *
 * 载具纪律：P1 断言全部读取运行时行为（公共导出存在性、真实落盘 record、onEvent 事件）；
 * P2 的交付物本身即文档文本，故以文档内容契约锚定（不属于「以源码字符串断言伪造行为
 * 验证」——这里没有可运行的 P2 行为面，交付物就是文档）。
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  readStreamStrict,
  type NamespaceDiagnosticChangeEmission,
} from '@nomicore/namespace-diagnostic-log';

const NOW_MS = Date.parse('2026-09-14T00:00:00.000Z');
const NS_A = 'ns-000000000000000000000000000000a1';
const NS_B = 'ns-000000000000000000000000000000b1';

const tempRoots: string[] = [];
function freshRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}
afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function emissionFor(attemptId: string): NamespaceDiagnosticChangeEmission {
  return {
    operation: 'root-mutation',
    stage: 'transaction',
    observedAt: new Date(NOW_MS).toISOString(),
    attemptId,
    source: { kind: 'local' },
    input: { status: 'not-accessed' },
    result: { kind: 'committed', effect: 'noop' },
  };
}

type AnyEmitter = { emit(emission: unknown): void };
interface GeneralizedManager {
  readonly binding: {
    readonly emitter: AnyEmitter;
    readonly initStream?: (namespaceId: string, genesisUpdateBytes: Uint8Array | undefined) => void;
    readonly runtimeEmitterFor?: (namespaceId: string) => AnyEmitter | undefined;
  };
  readonly retireNamespace: (namespaceId: string) => void;
  readonly close: () => void;
}
interface GeneralizedDeps {
  readonly onEvent?: (event: Record<string, unknown>) => void;
  readonly now: () => number;
}

/** 公共入口（apps/yjs-server 的 package entry）动态读取——缺席即 P1 红线。 */
async function publicEntry(): Promise<Record<string, unknown>> {
  const mod = (await import('../src/index.js')) as unknown as Record<string, unknown>;
  return mod;
}

function requireFactory(mod: Record<string, unknown>): (
  config: { rootDir: string },
  deps: GeneralizedDeps,
) => GeneralizedManager {
  const factory = mod.createHostDiagnosticsManager;
  expect(
    typeof factory,
    'P1：createHostDiagnosticsManager 必须从 apps/yjs-server 公共入口导出（全仓单份实现）',
  ).toBe('function');
  if (typeof factory !== 'function') throw new Error('unreachable after assertion');
  return factory as (config: { rootDir: string }, deps: GeneralizedDeps) => GeneralizedManager;
}

function streamIdOf(rootDir: string, namespaceId: string): string {
  const current = JSON.parse(
    readFileSync(join(rootDir, 'namespaces', namespaceId, 'current.json'), 'utf8'),
  ) as { streamId?: unknown };
  expect(typeof current.streamId, `current.json 必须携带 streamId（${namespaceId}）`).toBe('string');
  return current.streamId as string;
}

function recordOperations(rootDir: string, namespaceId: string, streamId: string): string[] {
  const read = readStreamStrict({ rootDir, namespaceId, streamId });
  expect(read.status, `strict reader 读取失败：${JSON.stringify(read)}`).toBe('ok');
  return read.records
    .filter((entry) => entry.ok && entry.record !== null)
    .map((entry) => entry.record as unknown as Record<string, unknown>)
    .filter((record) => record.recordKind === 'attempt')
    .map((record) => String(record.operation));
}

/**
 * 泛化签名敏感性探针：未泛化的 manager（仍读 `deps.sink`）在 `emit` 内同步 throw——
 * 捕获并显式断言「零 throw」，使 P1 红线失败信息直指签名未泛化（而非到达型噪声）。
 */
function emitCapturingThrows(
  target: AnyEmitter | undefined,
  emission: unknown,
  failures: string[],
): void {
  try {
    target?.emit(emission);
  } catch (err) {
    failures.push(String(err));
  }
}

// ═════════════════════════ P1：公共导出 + 泛化签名 ═════════════════════════

describe('#393 P1 — @nomicore/yjs-server 导出泛化 Host 诊断 manager', () => {
  it('P1-R1 (RED): 公共入口导出 createHostDiagnosticsManager（app 内部同一实现）', async () => {
    const mod = await publicEntry();
    expect(typeof mod.createHostDiagnosticsManager).toBe('function');
  });

  it('P1-R2 (RED): 泛化签名可用——多 ns 数据键控落盘 + 无归属通道丢弃并上报 onEvent', async () => {
    const rootDir = freshRoot('issue393-p1-r2-');
    const events: Record<string, unknown>[] = [];
    const mod = await publicEntry();
    const factory = requireFactory(mod);
    // 泛化调用面：config 无 `enabled` 标志；deps = { onEvent, now }（无 stdout EventSink 语义）。
    const manager = factory({ rootDir }, { onEvent: (event) => events.push(event), now: () => NOW_MS });
    manager.binding.initStream?.(NS_A, undefined);

    const emitterA = manager.binding.runtimeEmitterFor?.(NS_A);
    expect(emitterA, 'runtimeEmitterFor 必须在场（数据键控解析面）').toBeDefined();
    const failures: string[] = [];
    emitCapturingThrows(emitterA, emissionFor('att-000000000000000000000000000000a1'), failures);
    // 无归属通道（共享 emitter）：恒丢弃 + 计数（#226/#228 冻结语义）——不落任何流。
    emitCapturingThrows(
      manager.binding.emitter,
      emissionFor('att-000000000000000000000000000000a2'),
      failures,
    );
    expect(failures, `泛化签名（onEvent/now）必须无 throw：${JSON.stringify(failures)}`).toEqual([]);

    const streamId = streamIdOf(rootDir, NS_A);
    const operations = recordOperations(rootDir, NS_A, streamId);
    expect(operations, `ns-a 流只应有数据键控记录：${JSON.stringify(operations)}`).toEqual(['root-mutation']);
    expect(
      events.some(
        (event) => event.event === 'diagnostic-log-emission-dropped' && event.reason === 'unattributed',
      ),
      `无归属 emission 必须经 onEvent 上报 unattributed 丢弃：${JSON.stringify(events)}`,
    ).toBe(true);

    manager.close();
  });

  it('P1-R3 (RED): close() 后运行时解析降级为 manager-closed 丢弃桩并经 onEvent 上报', async () => {
    const rootDir = freshRoot('issue393-p1-r3-');
    const events: Record<string, unknown>[] = [];
    const mod = await publicEntry();
    const manager = requireFactory(mod)({ rootDir }, { onEvent: (event) => events.push(event), now: () => NOW_MS });
    manager.close();
    const late = manager.binding.runtimeEmitterFor?.(NS_B);
    expect(late, 'close 后解析仍必须返回丢弃桩（形状完备）').toBeDefined();
    const failures: string[] = [];
    emitCapturingThrows(late, emissionFor('att-000000000000000000000000000000b1'), failures);
    expect(failures, `泛化签名（onEvent/now）必须无 throw：${JSON.stringify(failures)}`).toEqual([]);
    expect(
      events.some(
        (event) => event.event === 'diagnostic-log-emission-dropped' && event.reason === 'manager-closed',
      ),
      `close 后迟到 emission 必须上报 manager-closed：${JSON.stringify(events)}`,
    ).toBe(true);
  });

  it('P1-R4 (RED→GREEN 守护): retireNamespace 后迟到解析保持 namespace-deleted 丢弃语义', async () => {
    const rootDir = freshRoot('issue393-p1-g1-');
    const events: Record<string, unknown>[] = [];
    const mod = await publicEntry();
    // 该用例在 P1 红线期同样红（导出缺席）；独立成例以固定 retirement 语义不随泛化漂移。
    const manager = requireFactory(mod)({ rootDir }, { onEvent: (event) => events.push(event), now: () => NOW_MS });
    manager.binding.initStream?.(NS_B, undefined);
    manager.retireNamespace(NS_B);
    const late = manager.binding.runtimeEmitterFor?.(NS_B);
    const failures: string[] = [];
    emitCapturingThrows(late, emissionFor('att-000000000000000000000000000000b2'), failures);
    expect(failures, `泛化签名（onEvent/now）必须无 throw：${JSON.stringify(failures)}`).toEqual([]);
    expect(
      events.some(
        (event) => event.event === 'diagnostic-log-emission-dropped' && event.reason === 'namespace-deleted',
      ),
      `retirement 后必须 namespace-deleted：${JSON.stringify(events)}`,
    ).toBe(true);
    manager.close();
  });
});

// ═════════════════════════ P2：skill 文档配置节 + 路由 ═════════════════════════

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SKILL_DIR = join(REPO_ROOT, '.agents', 'skills', 'nomicore');

/** 提取 markdown 二级/三级标题所在节文本（含标题行到下一个同级或更高级标题）。 */
function sectionOf(markdown: string, headingPattern: RegExp): string | undefined {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^#{2,4}\s/.test(line) && headingPattern.test(line));
  if (start === -1) return undefined;
  const level = (lines[start]!.match(/^#+/) as RegExpMatchArray)[0]!.length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const match = lines[i]!.match(/^(#+)\s/);
    if (match !== null && match[1]!.length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

describe('#393 P2 — skill 诊断日志配置节与路由（文档交付物契约）', () => {
  it('P2-R1 (RED): cordis-host.md 存在诊断日志配置节，含单 ns / 多 ns / 裸 emitter 陷阱 / Hub-Peer 四面', () => {
    const doc = readFileSync(join(SKILL_DIR, 'cordis-host.md'), 'utf8');
    const section = sectionOf(doc, /诊断日志|diagnostic/i);
    expect(section, 'cordis-host.md 必须新增诊断日志配置节（标题含「诊断日志」）').toBeDefined();
    const text = section!;
    expect(text, '单 ns 正路必须点名 createFileDiagnosticLog 产物直传').toMatch(/createFileDiagnosticLog/);
    expect(text, '多 ns 正路必须点名导出的 manager').toMatch(/createHostDiagnosticsManager|HostDiagnosticsManager/);
    expect(
      text,
      '必须说明裸 {emitter} 形状 = legacy（仅 create 尝试 / runtime 级记录缺席）的陷阱',
    ).toMatch(/emitter/);
    expect(text, '裸 {emitter} 陷阱必须与 legacy 语义关联说明').toMatch(/legacy/i);
    expect(text, '必须给出 Hub/Peer 组合根示例').toMatch(/Hub/);
    expect(text, '必须给出 Hub/Peer 组合根示例').toMatch(/Peer/);
  });

  it('P2-R2 (RED): SKILL.md 路由表把诊断日志/observability 类请求导流到 cordis-host.md', () => {
    const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
    const routeLines = skill
      .split('\n')
      .filter((line) => line.trimStart().startsWith('-') && /cordis-host\.md/.test(line));
    expect(routeLines.length, 'SKILL.md 必须有导流到 cordis-host.md 的路由行').toBeGreaterThanOrEqual(1);
    expect(
      routeLines.some((line) => /诊断日志|diagnostic|observability/i.test(line)),
      `诊断日志/observability 类请求必须路由到 cordis-host.md：${JSON.stringify(routeLines)}`,
    ).toBe(true);
  });
});
